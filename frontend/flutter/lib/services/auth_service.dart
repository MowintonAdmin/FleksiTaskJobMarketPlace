import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/user.dart';

class AuthService {
  static final _dio = ApiClient.instance;

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final resp = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    return resp.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> register(Map<String, dynamic> payload) async {
    final resp = await _dio.post('/auth/register', data: payload);
    return resp.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> googleAuth(String idToken) async {
    final resp = await _dio.post('/auth/google', data: {'id_token': idToken});
    return resp.data as Map<String, dynamic>;
  }

  static Future<void> forgotPassword(String email) async {
    await _dio.post('/auth/forgot-password', data: {'email': email});
  }

  static Future<void> resetPassword(String token, String newPassword) async {
    await _dio.post('/auth/reset-password', data: {'token': token, 'new_password': newPassword});
  }

  static Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {}
    await SecureStorage.clearTokens();
  }

  static Future<User> getMe() async {
    final resp = await _dio.get('/users/me');
    return User.fromJson(resp.data);
  }

  static Future<User> updateMe(Map<String, dynamic> payload) async {
    final resp = await _dio.put('/users/me', data: payload);
    return User.fromJson(resp.data);
  }

  static Future<User> uploadPhoto(String filePath) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
    });
    final resp = await _dio.post(
      '/users/me/photo',
      data: form,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
    return User.fromJson(resp.data);
  }
}
