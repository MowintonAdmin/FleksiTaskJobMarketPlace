class Task {
  final String id;
  final String title;
  final String description;
  final String? requirements;
  final String location;
  final String category;
  final String status;
  final double payRatePerMinute;
  final int estimatedDurationMinutes;
  final int maxApplicants;
  final int applicationCount;
  final String? photoUrl;
  final DateTime? startsAt;
  final DateTime createdAt;

  const Task({
    required this.id,
    required this.title,
    required this.description,
    this.requirements,
    required this.location,
    required this.category,
    required this.status,
    required this.payRatePerMinute,
    required this.estimatedDurationMinutes,
    required this.maxApplicants,
    required this.applicationCount,
    this.photoUrl,
    this.startsAt,
    required this.createdAt,
  });

  double get totalPay => payRatePerMinute * estimatedDurationMinutes;

  factory Task.fromJson(Map<String, dynamic> j) => Task(
        id: j['id']?.toString() ?? '',
        title: j['title'] ?? '',
        description: j['description'] ?? '',
        requirements: j['requirements'],
        location: j['location'] ?? '',
        category: j['category'] ?? '',
        status: j['status'] ?? 'open',
        payRatePerMinute: (j['pay_rate_per_minute'] as num?)?.toDouble() ?? 0.0,
        estimatedDurationMinutes: (j['estimated_duration_minutes'] as num?)?.toInt() ?? 0,
        maxApplicants: (j['max_applicants'] as num?)?.toInt() ?? 1,
        applicationCount: (j['application_count'] as num?)?.toInt() ?? 0,
        photoUrl: j['photo_url'],
        startsAt: j['starts_at'] != null ? _parseUtc(j['starts_at']) : null,
        createdAt: j['created_at'] != null ? _parseUtc(j['created_at']) : DateTime.now(),
      );
}

DateTime _parseUtc(String s) {
  if (!s.endsWith('Z') && !RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(s)) {
    s = '${s}Z';
  }
  return DateTime.parse(s).toLocal();
}
