import 'task.dart';

class Application {
  final String id;
  final String taskId;
  final String status; // pending | accepted | rejected
  final String? coverNote;
  final Task? task;
  final DateTime createdAt;

  const Application({
    required this.id,
    required this.taskId,
    required this.status,
    this.coverNote,
    this.task,
    required this.createdAt,
  });

  factory Application.fromJson(Map<String, dynamic> j) => Application(
        id: j['id']?.toString() ?? '',
        taskId: j['task_id']?.toString() ?? '',
        status: j['status'] ?? 'pending',
        coverNote: j['cover_note'],
        task: j['task'] != null ? Task.fromJson(j['task']) : null,
        createdAt: j['created_at'] != null ? _parseUtc(j['created_at']) : DateTime.now(),
      );
}

DateTime _parseUtc(String s) {
  if (!s.endsWith('Z') && !RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(s)) {
    s = '${s}Z';
  }
  return DateTime.parse(s).toLocal();
}
