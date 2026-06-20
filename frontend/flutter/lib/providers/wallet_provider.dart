import 'package:flutter/foundation.dart';
import '../models/wallet.dart';
import '../services/wallet_service.dart';

class WalletProvider extends ChangeNotifier {
  Wallet? _wallet;
  List<WalletTransaction> _transactions = [];
  BankAccount? _bankAccount;
  List<Withdrawal> _withdrawals = [];
  bool _loading = false;
  String? _error;

  Wallet? get wallet => _wallet;

  /// Returns transactions with resolved WITHDRAWAL_PENDING entries removed.
  /// When a withdrawal is approved (WITHDRAWAL_COMPLETED) or rejected
  /// (WITHDRAWAL_REJECTED), the original WITHDRAWAL_PENDING entry for the
  /// same withdrawal is hidden to avoid showing a stale "-RM X" deduction
  /// that looks like the withdrawal was already approved/sent.
  List<WalletTransaction> get transactions {
    final resolvedIds = _transactions
        .where((t) =>
            t.type == 'WITHDRAWAL_COMPLETED' || t.type == 'WITHDRAWAL_REJECTED')
        .map((t) => t.referenceId)
        .whereType<String>()
        .toSet();
    return _transactions
        .where((t) => !(t.type == 'WITHDRAWAL_PENDING' &&
            resolvedIds.contains(t.referenceId)))
        .toList();
  }

  BankAccount? get bankAccount => _bankAccount;
  List<Withdrawal> get withdrawals => _withdrawals;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _wallet = await WalletService.getWallet();
      _transactions = await WalletService.getTransactions();
      _bankAccount = await WalletService.getBankAccount();
      _withdrawals = await WalletService.getWithdrawals();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> saveBankAccount(Map<String, dynamic> data) async {
    _bankAccount = await WalletService.upsertBankAccount(data);
    notifyListeners();
  }

  Future<void> requestWithdrawal(double amount) async {
    await WalletService.requestWithdrawal(amount);
    await load();
  }
}
