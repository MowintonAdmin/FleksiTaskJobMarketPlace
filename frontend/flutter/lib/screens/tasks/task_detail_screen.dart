import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/app_config.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/task_provider.dart';
import '../../services/task_service.dart';
import '../../models/application.dart';

class TaskDetailScreen extends StatefulWidget {
  final String taskId;

  const TaskDetailScreen({super.key, required this.taskId});

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  final _coverNoteCtrl = TextEditingController();
  bool _applying = false;
  bool _applied = false;
  Application? _myApplication;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TaskProvider>().fetchTask(widget.taskId);
      _checkExistingApplication();
    });
  }

  Future<void> _checkExistingApplication() async {
    try {
      final apps = await TaskService.getMyApplications();
      final app = apps.where((a) => a.taskId == widget.taskId).firstOrNull;
      if (mounted) setState(() => _myApplication = app);
    } catch (_) {}
  }

  @override
  void dispose() {
    _coverNoteCtrl.dispose();
    context.read<TaskProvider>().clearSelectedTask();
    super.dispose();
  }

  Future<void> _apply() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) {
      context.push('/login');
      return;
    }
    setState(() => _applying = true);
    try {
      final app = await TaskService.apply(widget.taskId, coverNote: _coverNoteCtrl.text.trim());
      if (mounted) {
        setState(() {
          _applied = true;
          _myApplication = app;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Application submitted! You\'ll be notified of the status.'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_extractError(e)), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  String _extractError(dynamic e) {
    try {
      return (e as dynamic).response?.data?['detail']?.toString() ?? e.toString();
    } catch (_) {
      return e.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final taskProv = context.watch<TaskProvider>();
    final task = taskProv.selectedTask;
    final isLoggedIn = context.watch<AuthProvider>().isLoggedIn;

    if (taskProv.loading || task == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final isExpired = task.startsAt != null && task.startsAt!.isBefore(DateTime.now());
    final canApply = task.status == 'open' && !isExpired;

    return Scaffold(
      appBar: AppBar(title: Text(task.title, overflow: TextOverflow.ellipsis)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Photo
          if (task.photoUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: CachedNetworkImage(
                imageUrl: '$kApiBaseUrl/../.${task.photoUrl}',
                height: 200,
                fit: BoxFit.cover,
              ),
            ),
          const SizedBox(height: 16),

          // Header card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: 8, children: [
                  _StatusChip(task.status),
                  _CategoryChip(task.category),
                ]),
                const SizedBox(height: 10),
                Text(task.title, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 4),
                Row(children: [
                  const Icon(Icons.location_on_outlined, size: 16, color: AppColors.gray400),
                  const SizedBox(width: 4),
                  Text(task.location, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.gray500)),
                ]),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Total Pay', style: Theme.of(context).textTheme.bodySmall),
                      Text('RM ${task.totalPay.toStringAsFixed(2)}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      Text('RM ${task.payRatePerMinute}/min × ${task.estimatedDurationMinutes} min', style: Theme.of(context).textTheme.bodySmall),
                    ]),
                  ),
                ]),
                const Divider(height: 24),
                Row(children: [
                  _StatItem('Duration', '${task.estimatedDurationMinutes} min'),
                  _StatItem('Applications', '${task.applicationCount}'),
                  _StatItem('Spots', '${task.maxApplicants}'),
                ]),
              ]),
            ),
          ),
          const SizedBox(height: 12),

          // Description
          _SectionCard(title: 'Description', body: task.description),
          if (task.requirements != null) ...[
            const SizedBox(height: 12),
            _SectionCard(title: 'Requirements', body: task.requirements!),
          ],
          if (task.startsAt != null) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(children: [
                  const Text('🗓', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Text('Starts: '),
                  Text(_formatDateTime(task.startsAt!), style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ],
          const SizedBox(height: 16),

          // My accepted application — can check in
          if (_myApplication?.status == 'accepted') ...[
            ElevatedButton.icon(
              icon: const Icon(Icons.play_circle_outline),
              label: const Text('Start Task (Check In)'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
              onPressed: () => context.push('/tracking/${_myApplication!.id}'),
            ),
            const SizedBox(height: 8),
          ],

          // Apply section
          if (canApply && _myApplication == null && !_applied)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('Apply for this Task', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _coverNoteCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Optional: Add a brief note about why you\'re a good fit...',
                    ),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _applying ? null : _apply,
                    child: _applying
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('⚡ Apply Now (One Tap)'),
                  ),
                  if (!isLoggedIn)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text('You\'ll be redirected to login first', style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
                    ),
                ]),
              ),
            ),

          if (_applied || _myApplication?.status == 'pending')
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.successLight, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('✓ Application Submitted!', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('You\'ll receive a notification when your application is reviewed.', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.success)),
              ]),
            ),

          if (isExpired)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.gray100, borderRadius: BorderRadius.circular(16)),
              child: Text('This task has already started.', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.gray500)),
            ),
        ]),
      ),
    );
  }
}

Widget _StatusChip(String status) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: status == 'open' ? AppColors.successLight : AppColors.gray100, borderRadius: BorderRadius.circular(20)),
    child: Text(status.replaceAll('_', ' '), style: TextStyle(color: status == 'open' ? AppColors.success : AppColors.gray500, fontSize: 12, fontWeight: FontWeight.w600)),
  );
}

Widget _CategoryChip(String cat) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: AppColors.gray100, borderRadius: BorderRadius.circular(20)),
      child: Text(cat, style: const TextStyle(color: AppColors.gray500, fontSize: 12)),
    );

class _StatItem extends StatelessWidget {
  final String label;
  final String value;

  const _StatItem(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
      ]),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final String body;

  const _SectionCard({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(body, style: Theme.of(context).textTheme.bodyMedium),
        ]),
      ),
    );
  }
}

String _formatDateTime(DateTime dt) =>
    '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
