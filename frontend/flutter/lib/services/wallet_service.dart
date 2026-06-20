import '../core/api_client.dart';
import '../models/wallet.dart';

class WalletService {
  static final _dio = ApiClient.instance;

  static Future<Wallet> getWallet() async {
    final resp = await _dio.get('/wallet');
    return Wallet.fromJson(resp.data);
  }

  static Future<List<WalletTransaction>> getTransactions() async {
    final resp = await _dio.get('/wallet/transactions');
    return (resp.data as List).map((e) => WalletTransaction.fromJson(e)).toList();
  }

  static Future<BankAccount?> getBankAccount() async {
    try {
      final resp = await _dio.get('/wallet/bank-account');
      if (resp.data == null) return null;
      return BankAccount.fromJson(resp.data);
    } catch (_) {
      return null;
    }
  }

  static Future<BankAccount> upsertBankAccount(Map<String, dynamic> data) async {
    final resp = await _dio.put('/wallet/bank-account', data: data);
    return BankAccount.fromJson(resp.data);
  }

  static Future<List<Withdrawal>> getWithdrawals() async {
    final resp = await _dio.get('/wallet/withdrawals');
    return (resp.data as List).map((e) => Withdrawal.fromJson(e)).toList();
  }

  static Future<Withdrawal> requestWithdrawal(double amount) async {
    final resp = await _dio.post('/wallet/withdraw', data: {'amount': amount});
    return Withdrawal.fromJson(resp.data);
  }
}
