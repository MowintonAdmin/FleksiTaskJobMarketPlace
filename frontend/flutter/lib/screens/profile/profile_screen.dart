import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

const _kSkillsSuggestions = [
  'Cleaning', 'Driving', 'Delivery', 'Moving', 'Gardening',
  'Cooking', 'Tech Support', 'Tutoring', 'Painting', 'Plumbing',
];

const _kQualifications = [
  'No Formal Education', 'Primary School', 'PMR / PT3', 'SPM', 'STPM',
  'Certificate', 'Diploma', "Bachelor's Degree", "Master's Degree",
  'PhD / Doctorate', 'Others',
];

const _kRaces = ['Malay', 'Chinese', 'Indian', 'Kadazan', 'Iban', 'Orang Asli', 'Others'];

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final _nameCtrl;
  late final _bioCtrl;
  late final _locationCtrl;
  late final _nricCtrl;
  late final _heightCtrl;
  late final _nationalityCtrl;
  late final _skillCtrl = TextEditingController();

  String? _qualification;
  String? _race;
  List<String> _skills = [];
  bool _saving = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameCtrl = TextEditingController(text: user?.fullName ?? '');
    _bioCtrl = TextEditingController(text: user?.bio ?? '');
    _locationCtrl = TextEditingController(text: user?.location ?? '');
    _nricCtrl = TextEditingController(text: user?.nricPassport ?? '');
    _heightCtrl = TextEditingController(text: user?.bodyHeightCm?.toString() ?? '');
    _nationalityCtrl = TextEditingController(text: user?.nationality ?? '');
    _qualification = user?.academicQualification;
    _race = user?.race;
    _skills = List.from(user?.skills ?? []);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _bioCtrl.dispose();
    _locationCtrl.dispose();
    _nricCtrl.dispose();
    _heightCtrl.dispose();
    _nationalityCtrl.dispose();
    _skillCtrl.dispose();
    super.dispose();
  }

  void _addSkill(String s) {
    s = s.trim();
    if (s.isEmpty || _skills.contains(s)) return;
    setState(() { _skills = [..._skills, s]; _skillCtrl.clear(); });
  }

  void _removeSkill(String s) => setState(() => _skills = _skills.where((x) => x != s).toList());

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await context.read<AuthProvider>().updateProfile({
        'full_name': _nameCtrl.text.trim(),
        'bio': _bioCtrl.text.trim().isEmpty ? null : _bioCtrl.text.trim(),
        'location': _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
        'skills': _skills,
        'academic_qualification': _qualification,
        'body_height_cm': double.tryParse(_heightCtrl.text),
        'nationality': _nationalityCtrl.text.trim().isEmpty ? null : _nationalityCtrl.text.trim(),
        'race': _race,
        'nric_passport': _nricCtrl.text.trim().isEmpty ? null : _nricCtrl.text.trim(),
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated!'), backgroundColor: AppColors.success));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _uploadPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    setState(() => _uploading = true);
    try {
      await context.read<AuthProvider>().uploadPhoto(picked.path);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo updated!'), backgroundColor: AppColors.success));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Photo Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                GestureDetector(
                  onTap: _uploadPhoto,
                  child: Stack(
                    children: [
                      user?.profilePhotoUrl != null
                          ? CircleAvatar(backgroundImage: NetworkImage(user!.profilePhotoUrl!), radius: 40)
                          : CircleAvatar(
                              radius: 40,
                              backgroundColor: AppColors.primaryLight,
                              child: Text(
                                user?.fullName.isNotEmpty == true ? user!.fullName[0].toUpperCase() : 'U',
                                style: const TextStyle(color: AppColors.primary, fontSize: 28, fontWeight: FontWeight.w700),
                              ),
                            ),
                      if (_uploading)
                        Positioned.fill(
                          child: Container(
                            decoration: const BoxDecoration(color: Colors.white60, shape: BoxShape.circle),
                            child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                          ),
                        ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                          child: const Icon(Icons.camera_alt, color: Colors.white, size: 14),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(user?.fullName ?? '', style: Theme.of(context).textTheme.titleMedium),
                    Text(user?.email ?? '', style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 4),
                    Text(user?.role.toUpperCase() ?? '', style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 12),

          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Personal Info', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 16),
                _Field(label: 'Full Name', ctrl: _nameCtrl, icon: Icons.person_outlined, maxLength: 255),
                const SizedBox(height: 12),
                _Field(label: 'Location', ctrl: _locationCtrl, icon: Icons.location_on_outlined, hint: 'e.g. Kuala Lumpur'),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _bioCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Bio',
                    prefixIcon: Icon(Icons.info_outlined),
                    hintText: 'Tell employers about yourself...',
                  ),
                ),
                const SizedBox(height: 12),
                _Field(label: 'NRIC / Passport', ctrl: _nricCtrl, icon: Icons.badge_outlined),
                const SizedBox(height: 12),
                _Field(label: 'Nationality', ctrl: _nationalityCtrl, icon: Icons.flag_outlined),
                const SizedBox(height: 12),
                _Field(label: 'Height (cm)', ctrl: _heightCtrl, icon: Icons.height, type: TextInputType.number),
              ]),
            ),
          ),
          const SizedBox(height: 12),

          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Qualifications', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _qualification,
                  decoration: const InputDecoration(labelText: 'Academic Qualification', prefixIcon: Icon(Icons.school_outlined)),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('— Select —')),
                    ..._kQualifications.map((q) => DropdownMenuItem(value: q, child: Text(q))),
                  ],
                  onChanged: (v) => setState(() => _qualification = v),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _race,
                  decoration: const InputDecoration(labelText: 'Race', prefixIcon: Icon(Icons.people_outline)),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('— Select —')),
                    ..._kRaces.map((r) => DropdownMenuItem(value: r, child: Text(r))),
                  ],
                  onChanged: (v) => setState(() => _race = v),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 12),

          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Skills', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    ..._skills.map((s) => Chip(
                          label: Text(s),
                          onDeleted: () => _removeSkill(s),
                          deleteIcon: const Icon(Icons.close, size: 14),
                        )),
                  ],
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: TextFormField(
                      controller: _skillCtrl,
                      decoration: const InputDecoration(hintText: 'Add a skill...'),
                      onFieldSubmitted: _addSkill,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(icon: const Icon(Icons.add), onPressed: () => _addSkill(_skillCtrl.text)),
                ]),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: _kSkillsSuggestions
                      .where((s) => !_skills.contains(s))
                      .map((s) => ActionChip(label: Text(s, style: const TextStyle(fontSize: 12)), onPressed: () => _addSkill(s)))
                      .toList(),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 12),

          // Logout
          OutlinedButton.icon(
            icon: const Icon(Icons.logout, color: AppColors.error),
            label: const Text('Sign Out', style: TextStyle(color: AppColors.error)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.error)),
            onPressed: () async {
              await context.read<AuthProvider>().logout();
              if (mounted) context.go('/login');
            },
          ),
          const SizedBox(height: 24),
        ]),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final String label;
  final TextEditingController ctrl;
  final IconData icon;
  final String? hint;
  final TextInputType? type;
  final int? maxLength;

  const _Field({required this.label, required this.ctrl, required this.icon, this.hint, this.type, this.maxLength});

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: ctrl,
      keyboardType: type,
      maxLength: maxLength,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        hintText: hint,
      ),
    );
  }
}
