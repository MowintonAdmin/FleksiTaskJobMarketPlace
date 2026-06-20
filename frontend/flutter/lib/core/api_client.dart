import 'package:dio/dio.dart';
import '../config/app_config.dart';
import 'secure_storage.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._();
  factory ApiClient() => _instance;
  ApiClient._();

  late final Dio dio = _buildDio();

  Dio _buildDio() {
    final d = Dio(
      BaseOptions(
        baseUrl: kApiBaseUrl,
        headers: {'Content-Type': 'application/json'},
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
      ),
    );
    d.interceptors.add(_AuthInterceptor(d));
    return d;
  }

  /// Convenience accessor so callers can do `api.get(...)` directly.
  static Dio get instance => ApiClient().dio;
}

class _AuthInterceptor extends Interceptor {
  final Dio _dio;
  bool _isRefreshing = false;
  final List<({RequestOptions opts, ErrorInterceptorHandler handler})> _pending = [];

  _AuthInterceptor(this._dio);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await SecureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    final opts = err.requestOptions;
    // Avoid infinite retry loop on the refresh endpoint itself.
    if (opts.path.contains('/auth/refresh')) {
      handler.next(err);
      return;
    }

    if (_isRefreshing) {
      _pending.add((opts: opts, handler: handler));
      return;
    }

    _isRefreshing = true;
    try {
      final refreshToken = await SecureStorage.getRefreshToken();
      if (refreshToken == null) throw Exception('no_refresh');

      final resp = await Dio().post(
        '$kApiBaseUrl/auth/refresh',
        data: {'refresh_token': refreshToken},
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      final newAccess = resp.data['access_token'] as String;
      final newRefresh = resp.data['refresh_token'] as String;
      await SecureStorage.saveTokens(
        accessToken: newAccess,
        refreshToken: newRefresh,
      );

      // Retry the original request with the new token.
      opts.headers['Authorization'] = 'Bearer $newAccess';
      final retried = await _dio.fetch(opts);
      handler.resolve(retried);

      // Also flush any queued requests.
      for (final p in _pending) {
        p.opts.headers['Authorization'] = 'Bearer $newAccess';
        _dio.fetch(p.opts).then(
          (r) => p.handler.resolve(r),
          onError: (e) => p.handler.next(e is DioException ? e : DioException(requestOptions: p.opts, error: e)),
        );
      }
      _pending.clear();
    } catch (_) {
      await SecureStorage.clearTokens();
      for (final p in _pending) {
        p.handler.next(DioException(requestOptions: p.opts, error: 'Session expired'));
      }
      _pending.clear();
      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}
