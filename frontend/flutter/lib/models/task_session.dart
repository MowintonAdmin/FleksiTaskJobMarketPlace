class TaskSession {
  final String id;
  final String applicationId;
  final String status; // active | paused | completed
  final DateTime checkedInAt;
  final DateTime? checkedOutAt;
  final double? earnings;
  final String? proofPhotoUrl;
  final String? proofNotes;

  const TaskSession({
    required this.id,
    required this.applicationId,
    required this.status,
    required this.checkedInAt,
    this.checkedOutAt,
    this.earnings,
    this.proofPhotoUrl,
    this.proofNotes,
  });

  factory TaskSession.fromJson(Map<String, dynamic> j) => TaskSession(
        id: j['id']?.toString() ?? '',
        applicationId: j['application_id']?.toString() ?? '',
        status: j['status'] ?? 'active',
        checkedInAt: _parseUtc(j['checked_in_at'] ?? DateTime.now().toIso8601String()),
        checkedOutAt: j['checked_out_at'] != null ? _parseUtc(j['checked_out_at']) : null,
        earnings: (j['earnings'] as num?)?.toDouble(),
        proofPhotoUrl: j['proof_photo_url'],
        proofNotes: j['proof_notes'],
      );
}

DateTime _parseUtc(String s) {
  if (!s.endsWith('Z') && !RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(s)) {
    s = '${s}Z';
  }
  return DateTime.parse(s).toLocal();
}
