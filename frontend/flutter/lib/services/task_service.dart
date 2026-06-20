import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/task.dart';
import '../models/application.dart';
import '../models/task_session.dart';

class TaskService {
  static final _dio = ApiClient.instance;

  // ── Tasks ────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> listTasks({
    int page = 1,
    int pageSize = 20,
    String? location,
    String? category,
    double? minPay,
    double? maxPay,
  }) async {
    final params = <String, dynamic>{'page': page, 'page_size': pageSize};
    if (location != null && location.isNotEmpty) params['location'] = location;
    if (category != null && category.isNotEmpty) params['category'] = category;
    if (minPay != null) params['min_pay'] = minPay;
    if (maxPay != null) params['max_pay'] = maxPay;

    final resp = await _dio.get('/tasks', queryParameters: params);
    final data = resp.data as Map<String, dynamic>;
    return {
      'items': (data['items'] as List).map((e) => Task.fromJson(e)).toList(),
      'total': data['total'] ?? 0,
      'page': data['page'] ?? 1,
      'total_pages': data['total_pages'] ?? 1,
    };
  }

  static Future<Task> getTask(String id) async {
    final resp = await _dio.get('/tasks/$id');
    return Task.fromJson(resp.data);
  }

  // ── Applications ─────────────────────────────────────────────────────────
  static Future<Application> apply(String taskId, {String? coverNote}) async {
    final resp = await _dio.post('/applications', data: {
      'task_id': taskId,
      if (coverNote != null && coverNote.isNotEmpty) 'cover_note': coverNote,
    });
    return Application.fromJson(resp.data);
  }

  static Future<List<Application>> getMyApplications() async {
    final resp = await _dio.get('/applications/my');
    return (resp.data as List).map((e) => Application.fromJson(e)).toList();
  }

  // ── Task Sessions ────────────────────────────────────────────────────────
  static Future<TaskSession> checkIn(String applicationId) async {
    final resp = await _dio.post('/task-sessions/checkin', data: {'application_id': applicationId});
    return TaskSession.fromJson(resp.data);
  }

  static Future<TaskSession> checkOut(String sessionId, {String? proofNotes, String? photoPath}) async {
    if (photoPath != null) {
      final form = FormData.fromMap({
        if (proofNotes != null) 'proof_notes': proofNotes,
        'proof_photo': await MultipartFile.fromFile(photoPath),
      });
      final resp = await _dio.post('/task-sessions/$sessionId/checkout', data: form);
      return TaskSession.fromJson(resp.data);
    } else {
      final resp = await _dio.post('/task-sessions/$sessionId/checkout-simple', data: {
        'proof_notes': proofNotes,
      });
      return TaskSession.fromJson(resp.data);
    }
  }

  static Future<TaskSession> pauseSession(String sessionId) async {
    final resp = await _dio.post('/task-sessions/$sessionId/pause');
    return TaskSession.fromJson(resp.data);
  }

  static Future<TaskSession?> getActiveSession() async {
    try {
      final resp = await _dio.get('/task-sessions/active');
      if (resp.data == null) return null;
      return TaskSession.fromJson(resp.data);
    } catch (_) {
      return null;
    }
  }

  static Future<List<TaskSession>> getMySessions() async {
    final resp = await _dio.get('/task-sessions/my');
    return (resp.data as List).map((e) => TaskSession.fromJson(e)).toList();
  }
}
