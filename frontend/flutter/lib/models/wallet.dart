class Wallet {
  final String id;
  final double availableBalance;
  final double pendingBalance;

  const Wallet({
    required this.id,
    required this.availableBalance,
    required this.pendingBalance,
  });

  factory Wallet.fromJson(Map<String, dynamic> j) => Wallet(
        id: j['id']?.toString() ?? '',
        availableBalance: (j['available_balance'] as num?)?.toDouble() ?? 0.0,
        pendingBalance: (j['pending_balance'] as num?)?.toDouble() ?? 0.0,
      );
}

class WalletTransaction {
  final String id;
  final String type; // CREDIT | WITHDRAWAL_PENDING | WITHDRAWAL_COMPLETED | WITHDRAWAL_REJECTED
  final double amount;
  final String? description;
  final String? referenceId; // withdrawal request ID for WITHDRAWAL_* types
  final DateTime createdAt;

  const WalletTransaction({
    required this.id,
    required this.type,
    required this.amount,
    this.description,
    this.referenceId,
    required this.createdAt,
  });

  factory WalletTransaction.fromJson(Map<String, dynamic> j) => WalletTransaction(
        id: j['id']?.toString() ?? '',
        type: j['type'] ?? 'CREDIT',
        amount: (j['amount'] as num?)?.toDouble() ?? 0.0,
        description: j['description'],
        referenceId: j['reference_id']?.toString(),
        createdAt: j['created_at'] != null ? _parseUtc(j['created_at']) : DateTime.now(),
      );
}

class BankAccount {
  final String? bankName;
  final String? accountNumber;
  final String? accountHolderName;

  const BankAccount({this.bankName, this.accountNumber, this.accountHolderName});

  factory BankAccount.fromJson(Map<String, dynamic> j) => BankAccount(
        bankName: j['bank_name'],
        accountNumber: j['account_number'],
        accountHolderName: j['account_holder_name'],
      );
}

class Withdrawal {
  final String id;
  final double amount;
  final String status; // PENDING | APPROVED | REJECTED
  final DateTime createdAt;

  const Withdrawal({
    required this.id,
    required this.amount,
    required this.status,
    required this.createdAt,
  });

  factory Withdrawal.fromJson(Map<String, dynamic> j) => Withdrawal(
        id: j['id']?.toString() ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0.0,
        status: j['status'] ?? 'PENDING',
        createdAt: j['created_at'] != null ? _parseUtc(j['created_at']) : DateTime.now(),
      );
}

DateTime _parseUtc(String s) {
  if (!s.endsWith('Z') && !RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(s)) {
    s = '${s}Z';
  }
  return DateTime.parse(s).toLocal();
}
