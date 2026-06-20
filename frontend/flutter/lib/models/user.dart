class User {
  final String id;
  final String email;
  final String fullName;
  final String? bio;
  final String? location;
  final String? profilePhotoUrl;
  final List<String> skills;
  final String? academicQualification;
  final double? bodyHeightCm;
  final String? nationality;
  final String? race;
  final String? nricPassport;
  final String role;

  const User({
    required this.id,
    required this.email,
    required this.fullName,
    this.bio,
    this.location,
    this.profilePhotoUrl,
    this.skills = const [],
    this.academicQualification,
    this.bodyHeightCm,
    this.nationality,
    this.race,
    this.nricPassport,
    required this.role,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id']?.toString() ?? '',
        email: j['email'] ?? '',
        fullName: j['full_name'] ?? '',
        bio: j['bio'],
        location: j['location'],
        profilePhotoUrl: j['profile_photo_url'],
        skills: (j['skills'] as List?)?.cast<String>() ?? [],
        academicQualification: j['academic_qualification'],
        bodyHeightCm: (j['body_height_cm'] as num?)?.toDouble(),
        nationality: j['nationality'],
        race: j['race'],
        nricPassport: j['nric_passport'],
        role: j['role'] ?? 'worker',
      );

  Map<String, dynamic> toJson() => {
        'full_name': fullName,
        'bio': bio,
        'location': location,
        'skills': skills,
        'academic_qualification': academicQualification,
        'body_height_cm': bodyHeightCm,
        'nationality': nationality,
        'race': race,
        'nric_passport': nricPassport,
      };

  User copyWith({
    String? fullName,
    String? bio,
    String? location,
    String? profilePhotoUrl,
    List<String>? skills,
    String? academicQualification,
    double? bodyHeightCm,
    String? nationality,
    String? race,
    String? nricPassport,
  }) =>
      User(
        id: id,
        email: email,
        fullName: fullName ?? this.fullName,
        bio: bio ?? this.bio,
        location: location ?? this.location,
        profilePhotoUrl: profilePhotoUrl ?? this.profilePhotoUrl,
        skills: skills ?? this.skills,
        academicQualification: academicQualification ?? this.academicQualification,
        bodyHeightCm: bodyHeightCm ?? this.bodyHeightCm,
        nationality: nationality ?? this.nationality,
        race: race ?? this.race,
        nricPassport: nricPassport ?? this.nricPassport,
        role: role,
      );
}
