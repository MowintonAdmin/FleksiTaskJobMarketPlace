import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../core/secure_storage.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  AuthStatus _status = AuthStatus.unknown;
  User? _user;
  String? _error;

  AuthStatus get status => _status;
  User? get user => _user;
  String? get error => _error;
  bool get isLoggedIn => _status == AuthStatus.authenticated;

  static final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

  Future<void> initialize() async {
    final token = await SecureStorage.getAccessToken();
    if (token == null) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      _user = await AuthService.getMe();
      _status = AuthStatus.authenticated;
    } catch (_) {
      await SecureStorage.clearTokens();
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _error = null;
    try {
      final data = await AuthService.login(email, password);
      await _handleAuthResponse(data);
      return true;
    } catch (e) {
      _error = _extractError(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(Map<String, dynamic> payload) async {
    _error = null;
    try {
      final data = await AuthService.register(payload);
      await _handleAuthResponse(data);
      return true;
    } catch (e) {
      _error = _extractError(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> googleSignIn() async {
    _error = null;
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) return false;
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) throw Exception('No ID token');
      final data = await AuthService.googleAuth(idToken);
      await _handleAuthResponse(data);
      return true;
    } catch (e) {
      _error = _extractError(e);
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await AuthService.logout();
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<void> updateProfile(Map<String, dynamic> payload) async {
    final updated = await AuthService.updateMe(payload);
    _user = updated;
    notifyListeners();
  }

  Future<void> uploadPhoto(String filePath) async {
    final updated = await AuthService.uploadPhoto(filePath);
    _user = updated;
    notifyListeners();
  }

  Future<void> _handleAuthResponse(Map<String, dynamic> data) async {
    await SecureStorage.saveTokens(
      accessToken: data['access_token'] as String,
      refreshToken: data['refresh_token'] as String,
    );
    _user = await AuthService.getMe();
    _status = AuthStatus.authenticated;
    notifyListeners();
  }

  String _extractError(dynamic e) {
    try {
      // DioException has response data
      final resp = (e as dynamic).response?.data;
      if (resp is Map) return resp['detail']?.toString() ?? e.toString();
    } catch (_) {}
    return e.toString();
  }
}
