import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../config/theme.dart';
import '../../models/application.dart';
import '../../models/task.dart';
import '../../models/task_session.dart';
import '../../services/task_service.dart';

class TaskTrackingScreen extends StatefulWidget {
  final String applicationId;

  const TaskTrackingScreen({super.key, required this.applicationId});

  @override
  State<TaskTrackingScreen> createState() => _TaskTrackingScreenState();
}

class _TaskTrackingScreenState extends State<TaskTrackingScreen> {
  Task? _task;
  TaskSession? _session;
  bool _loading = true;
  bool _actionLoading = false;

  // Timer state — mirrors web TaskTracking.jsx logic
  int _elapsed = 0; // seconds
  int _maxSeconds = 0; // cap from estimated_duration_minutes
  Timer? _timer;

  // Checkout form
  bool _showCheckout = false;
  final _proofNotesCtrl = TextEditingController();
  File? _proofPhoto;
  bool _checkingOut = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _proofNotesCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final apps = await TaskService.getMyApplications();
      final app = apps.where((a) => a.id == widget.applicationId).firstOrNull;
      if (app == null) {
        if (mounted) context.go('/my-applications');
        return;
      }
      _task = app.task;

      // Try to get the active session for this application
      final sessions = await TaskService.getMySessions();
      final session = sessions.where((s) => s.applicationId == widget.applicationId).firstOrNull;

      if (mounted) {
        setState(() {
          _session = session;
          _loading = false;
        });
        if (session?.status == 'active') {
          _startTimer(session!.checkedInAt);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error));
      }
    }
  }

  void _startTimer(DateTime checkedInAt) {
    _timer?.cancel();
    final cap = (_task?.estimatedDurationMinutes ?? 0) * 60;
    _maxSeconds = cap;

    // Compute already-elapsed from server timestamp
    final nowSecs = DateTime.now().difference(checkedInAt).inSeconds.clamp(0, cap > 0 ? cap : 999999);

    if (cap > 0 && nowSecs >= cap) {
      setState(() {
        _elapsed = cap;
        _showCheckout = true;
      });
      return;
    }

    setState(() => _elapsed = nowSecs);

    // Poll every 250ms, matching web logic
    _timer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final secs = DateTime.now().difference(checkedInAt).inSeconds.clamp(0, cap > 0 ? cap : 999999);
      if (cap > 0 && secs >= cap) {
        _timer?.cancel();
        if (mounted) setState(() { _elapsed = cap; _showCheckout = true; });
      } else {
        if (mounted) setState(() => _elapsed = secs);
      }
    });
  }

  void _stopTimer() {
    _timer?.cancel();
  }

  Future<void> _checkIn() async {
    setState(() => _actionLoading = true);
    try {
      final session = await TaskService.checkIn(widget.applicationId);
      setState(() { _session = session; _actionLoading = false; });
      _startTimer(session.checkedInAt);
    } catch (e) {
      setState(() => _actionLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_extractError(e)), backgroundColor: AppColors.error));
    }
  }

  Future<void> _pause() async {
    _stopTimer();
    setState(() => _actionLoading = true);
    try {
      final session = await TaskService.pauseSession(_session!.id);
      setState(() { _session = session; _actionLoading = false; });
    } catch (e) {
      setState(() => _actionLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_extractError(e)), backgroundColor: AppColors.error));
    }
  }

  Future<void> _resume() async {
    setState(() => _actionLoading = true);
    try {
      final session = await TaskService.checkIn(widget.applicationId);
      setState(() { _session = session; _actionLoading = false; });
      _startTimer(session.checkedInAt);
    } catch (e) {
      setState(() => _actionLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_extractError(e)), backgroundColor: AppColors.error));
    }
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
    if (picked != null && mounted) {
      setState(() => _proofPhoto = File(picked.path));
    }
  }

  Future<void> _checkout() async {
    setState(() => _checkingOut = true);
    try {
      final session = await TaskService.checkOut(
        _session!.id,
        proofNotes: _proofNotesCtrl.text.trim().isEmpty ? null : _proofNotesCtrl.text.trim(),
        photoPath: _proofPhoto?.path,
      );
      setState(() { _session = session; _checkingOut = false; _showCheckout = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(session.earnings != null ? 'Checkout complete! Earned RM ${session.earnings!.toStringAsFixed(2)}' : 'Checked out successfully'),
            backgroundColor: AppColors.success,
          ),
        );
        context.go('/my-applications');
      }
    } catch (e) {
      setState(() => _checkingOut = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_extractError(e)), backgroundColor: AppColors.error));
    }
  }

  String _extractError(dynamic e) {
    try {
      return (e as dynamic).response?.data?['detail']?.toString() ?? e.toString();
    } catch (_) {
      return e.toString();
    }
  }

  // Compute real-time earnings like the web app
  double get _currentEarnings {
    if (_task == null) return 0;
    if (_session?.status == 'completed' || _session?.status == 'paused') {
      return _session?.earnings ?? 0;
    }
    final displayElapsed = _maxSeconds > 0 ? _elapsed.clamp(0, _maxSeconds) : _elapsed;
    final raw = (displayElapsed / 60) * _task!.payRatePerMinute;
    final max = _task!.totalPay;
    return raw > max ? max : raw;
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    if (h > 0) return '${h}h ${m}m ${s}s';
    return '${m}m ${s}s';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final task = _task;
    if (task == null) return const Scaffold(body: Center(child: Text('Task not found')));

    final cap = task.estimatedDurationMinutes * 60;
    final displayElapsed = cap > 0 ? _elapsed.clamp(0, cap) : _elapsed;
    final progress = cap > 0 ? displayElapsed / cap : 0.0;
    final isActive = _session?.status == 'active';
    final isPaused = _session?.status == 'paused';
    final isCompleted = _session?.status == 'completed';

    return Scaffold(
      appBar: AppBar(title: Text(task.title, overflow: TextOverflow.ellipsis)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Status Badge
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: isActive ? AppColors.successLight : isPaused ? AppColors.warningLight : AppColors.gray100,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isActive ? '● Active' : isPaused ? '⏸ Paused' : isCompleted ? '✓ Completed' : 'Not Started',
                style: TextStyle(
                  color: isActive ? AppColors.success : isPaused ? AppColors.warning : AppColors.gray500,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Timer display
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                Text(
                  _formatDuration(displayElapsed),
                  style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
                ),
                const SizedBox(height: 4),
                Text(
                  'of ${task.estimatedDurationMinutes} min',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                LinearProgressIndicator(
                  value: progress.toDouble(),
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(4),
                  backgroundColor: AppColors.gray100,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
                const SizedBox(height: 16),
                Text(
                  'RM ${_currentEarnings.toStringAsFixed(2)}',
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.primary),
                ),
                Text('current earnings', style: Theme.of(context).textTheme.bodySmall),
              ]),
            ),
          ),
          const SizedBox(height: 16),

          // Task info
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Task Info', style: Theme.of(context).textTheme.titleMedium),
                const Divider(height: 16),
                _InfoRow('Location', task.location),
                _InfoRow('Pay Rate', 'RM ${task.payRatePerMinute}/min'),
                _InfoRow('Total Pay', 'RM ${task.totalPay.toStringAsFixed(2)}'),
                _InfoRow('Duration', '${task.estimatedDurationMinutes} min'),
              ]),
            ),
          ),
          const SizedBox(height: 16),

          // Action buttons
          if (!isActive && !isPaused && !isCompleted)
            ElevatedButton.icon(
              icon: const Icon(Icons.play_arrow),
              label: Text(_actionLoading ? 'Checking In...' : 'Check In'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
              onPressed: _actionLoading ? null : _checkIn,
            )
          else if (isActive) ...[
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.pause),
                  label: Text(_actionLoading ? 'Pausing...' : 'Pause'),
                  onPressed: _actionLoading ? null : _pause,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.stop),
                  label: const Text('Check Out'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                  onPressed: () => setState(() { _showCheckout = true; _stopTimer(); }),
                ),
              ),
            ]),
          ]
          else if (isPaused) ...[
            Row(children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.play_arrow),
                  label: Text(_actionLoading ? 'Resuming...' : 'Resume'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                  onPressed: _actionLoading ? null : _resume,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.stop),
                  label: const Text('Check Out'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                  onPressed: () => setState(() => _showCheckout = true),
                ),
              ),
            ]),
          ],

          // Checkout form
          if (_showCheckout) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('Checkout', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),

                  // Photo proof
                  GestureDetector(
                    onTap: _pickPhoto,
                    child: Container(
                      height: 140,
                      decoration: BoxDecoration(
                        color: AppColors.gray100,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.gray200),
                        image: _proofPhoto != null
                            ? DecorationImage(image: FileImage(_proofPhoto!), fit: BoxFit.cover)
                            : null,
                      ),
                      child: _proofPhoto == null
                          ? const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Icon(Icons.camera_alt_outlined, size: 40, color: AppColors.gray400),
                              SizedBox(height: 8),
                              Text('Take a photo (optional)', style: TextStyle(color: AppColors.gray400)),
                            ])
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),

                  TextField(
                    controller: _proofNotesCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(hintText: 'Add notes about the work done (optional)'),
                  ),
                  const SizedBox(height: 16),

                  ElevatedButton(
                    onPressed: _checkingOut ? null : _checkout,
                    child: _checkingOut
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Submit & Check Out'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _checkingOut ? null : () {
                      setState(() => _showCheckout = false);
                      if (isActive) _startTimer(_session!.checkedInAt);
                    },
                    child: const Text('Cancel'),
                  ),
                ]),
              ),
            ),
          ],

          // Completed summary
          if (isCompleted && _session?.earnings != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.successLight, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('✓ Task Completed!', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 4),
                Text('Earned: RM ${_session!.earnings!.toStringAsFixed(2)}', style: const TextStyle(color: AppColors.success, fontSize: 14)),
              ]),
            ),
        ]),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const Spacer(),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ]),
    );
  }
}
