import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/wallet.dart';
import '../../providers/wallet_provider.dart';

const _kBanks = [
  'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank',
  'AmBank', 'Alliance Bank', 'Affin Bank', 'Bank Islam', 'Bank Muamalat',
  'Bank Rakyat', 'BSN (Bank Simpanan Nasional)', 'Agrobank', 'OCBC Bank Malaysia',
  'UOB Malaysia', 'Standard Chartered Malaysia', 'HSBC Bank Malaysia',
  'Citibank Malaysia', 'Kuwait Finance House', 'MBSB Bank',
];

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WalletProvider>().load();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final walletProv = context.watch<WalletProvider>();
    final wallet = walletProv.wallet;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Wallet'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'History'),
            Tab(text: 'Withdrawals'),
          ],
        ),
      ),
      body: walletProv.loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [
                // Tab 1: Overview
                _OverviewTab(wallet: wallet, walletProv: walletProv),
                // Tab 2: Transactions
                _TransactionsTab(transactions: walletProv.transactions),
                // Tab 3: Withdrawals
                _WithdrawalsTab(withdrawals: walletProv.withdrawals, walletProv: walletProv),
              ],
            ),
    );
  }
}

// ── Overview Tab ──────────────────────────────────────────────────────────
class _OverviewTab extends StatelessWidget {
  final Wallet? wallet;
  final WalletProvider walletProv;

  const _OverviewTab({required this.wallet, required this.walletProv});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: walletProv.load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Balance card
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF4F46E5)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Available Balance', style: TextStyle(color: Colors.white70, fontSize: 14)),
              const SizedBox(height: 8),
              Text('RM ${wallet?.availableBalance.toStringAsFixed(2) ?? '0.00'}',
                  style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w700)),

            ]),
          ),
          const SizedBox(height: 16),

          // Withdraw button
          ElevatedButton.icon(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: const Text('Request Withdrawal'),
            onPressed: () => _showWithdrawSheet(context, walletProv),
          ),
          const SizedBox(height: 16),

          // Bank account
          Card(
            child: ListTile(
              leading: const Icon(Icons.account_balance_outlined, color: AppColors.primary),
              title: Text(walletProv.bankAccount?.bankName ?? 'No bank account linked'),
              subtitle: walletProv.bankAccount != null
                  ? Text(walletProv.bankAccount!.accountHolderName ?? '')
                  : const Text('Add your bank details to withdraw'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _showBankSheet(context, walletProv),
            ),
          ),
        ],
      ),
    );
  }

  void _showWithdrawSheet(BuildContext context, WalletProvider walletProv) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WithdrawSheet(maxAmount: walletProv.wallet?.availableBalance ?? 0, walletProv: walletProv),
    );
  }

  void _showBankSheet(BuildContext context, WalletProvider walletProv) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _BankSheet(existing: walletProv.bankAccount, walletProv: walletProv),
    );
  }
}

// ── Transactions Tab ──────────────────────────────────────────────────────
class _TransactionsTab extends StatelessWidget {
  final List<WalletTransaction> transactions;

  const _TransactionsTab({required this.transactions});

  @override
  Widget build(BuildContext context) {
    if (transactions.isEmpty) {
      return const Center(child: Text('No transactions yet'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: transactions.length,
      itemBuilder: (_, i) => _TxnTile(txn: transactions[i]),
    );
  }
}

class _TxnTile extends StatelessWidget {
  final WalletTransaction txn;

  const _TxnTile({required this.txn});

  @override
  Widget build(BuildContext context) {
    final (icon, color, sign) = switch (txn.type) {
      'CREDIT' => ('💰', AppColors.success, '+'),
      'WITHDRAWAL_PENDING' => ('⏳', AppColors.warning, '-'),
      'WITHDRAWAL_COMPLETED' => ('✅', AppColors.gray500, '-'),
      'WITHDRAWAL_REJECTED' => ('↩️', Colors.blue, '+'),
      _ => ('💳', AppColors.gray500, ''),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Text(icon, style: const TextStyle(fontSize: 24)),
        title: Text(txn.description ?? txn.type.replaceAll('_', ' '), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        subtitle: Text(_formatDate(txn.createdAt), style: Theme.of(context).textTheme.bodySmall),
        trailing: Text(
          '$sign RM ${txn.amount.abs().toStringAsFixed(2)}',
          style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
    );
  }
}

// ── Withdrawals Tab ───────────────────────────────────────────────────────
class _WithdrawalsTab extends StatelessWidget {
  final List<Withdrawal> withdrawals;
  final WalletProvider walletProv;

  const _WithdrawalsTab({required this.withdrawals, required this.walletProv});

  @override
  Widget build(BuildContext context) {
    if (withdrawals.isEmpty) {
      return const Center(child: Text('No withdrawal requests yet'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: withdrawals.length,
      itemBuilder: (_, i) => _WithdrawalTile(wd: withdrawals[i]),
    );
  }
}

class _WithdrawalTile extends StatelessWidget {
  final Withdrawal wd;

  const _WithdrawalTile({required this.wd});

  @override
  Widget build(BuildContext context) {
    final (bgColor, fgColor) = switch (wd.status) {
      'APPROVED' => (AppColors.successLight, AppColors.success),
      'REJECTED' => (AppColors.errorLight, AppColors.error),
      _ => (AppColors.warningLight, AppColors.warning),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text('RM ${wd.amount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(_formatDate(wd.createdAt), style: Theme.of(context).textTheme.bodySmall),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(12)),
          child: Text(wd.status, style: TextStyle(color: fgColor, fontSize: 12, fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }
}

// ── Withdraw Bottom Sheet ─────────────────────────────────────────────────
class _WithdrawSheet extends StatefulWidget {
  final double maxAmount;
  final WalletProvider walletProv;

  const _WithdrawSheet({required this.maxAmount, required this.walletProv});

  @override
  State<_WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends State<_WithdrawSheet> {
  final _amountCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountCtrl.text);
    if (amount == null || amount <= 0) { setState(() => _error = 'Enter a valid amount'); return; }
    if (amount > widget.maxAmount) { setState(() => _error = 'Exceeds available balance'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      await widget.walletProv.requestWithdrawal(amount);
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Withdrawal requested!'), backgroundColor: AppColors.success));
      }
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.gray200, borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 16),
        Text('Request Withdrawal', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text('Available: RM ${widget.maxAmount.toStringAsFixed(2)}', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 16),
        if (_error != null)
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(10)),
            child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ),
        TextFormField(
          controller: _amountCtrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Amount (RM)', prefixIcon: Icon(Icons.attach_money)),
        ),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _loading ? null : _submit,
          child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Submit Request'),
        ),
      ]),
    );
  }
}

// ── Bank Account Bottom Sheet ─────────────────────────────────────────────
class _BankSheet extends StatefulWidget {
  final BankAccount? existing;
  final WalletProvider walletProv;

  const _BankSheet({this.existing, required this.walletProv});

  @override
  State<_BankSheet> createState() => _BankSheetState();
}

class _BankSheetState extends State<_BankSheet> {
  String? _bankName;
  final _accNoCtrl = TextEditingController();
  final _holderCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bankName = widget.existing?.bankName;
    _holderCtrl.text = widget.existing?.accountHolderName ?? '';
  }

  @override
  void dispose() {
    _accNoCtrl.dispose();
    _holderCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_bankName == null) { setState(() => _error = 'Please select a bank'); return; }
    if (_accNoCtrl.text.trim().isEmpty) { setState(() => _error = 'Account number required'); return; }
    if (!RegExp(r'^\d+$').hasMatch(_accNoCtrl.text.trim())) { setState(() => _error = 'Account number must be digits only'); return; }
    if (_holderCtrl.text.trim().isEmpty) { setState(() => _error = 'Account holder name required'); return; }

    setState(() { _loading = true; _error = null; });
    try {
      await widget.walletProv.saveBankAccount({
        'bank_name': _bankName,
        'account_number': _accNoCtrl.text.trim(),
        'account_holder_name': _holderCtrl.text.trim(),
      });
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bank account saved'), backgroundColor: AppColors.success));
      }
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.gray200, borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 16),
        Text('🏦 Bank Account Details', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 16),
        if (_error != null)
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(10)),
            child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ),
        DropdownButtonFormField<String>(
          value: _bankName,
          decoration: const InputDecoration(labelText: 'Bank Name'),
          items: [
            const DropdownMenuItem(value: null, child: Text('— Select your bank —')),
            ..._kBanks.map((b) => DropdownMenuItem(value: b, child: Text(b))),
          ],
          onChanged: (v) => setState(() => _bankName = v),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _accNoCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Account Number', hintText: 'Digits only'),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _holderCtrl,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Account Holder Name', hintText: 'Full name as per bank records'),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _loading ? null : _save,
          child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Save'),
        ),
      ]),
    );
  }
}

String _formatDate(DateTime dt) => '${dt.day}/${dt.month}/${dt.year}';
