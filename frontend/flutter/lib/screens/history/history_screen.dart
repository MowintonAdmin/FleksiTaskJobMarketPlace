import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/task_session.dart';
import '../../services/task_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<TaskSession> _sessions = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final sessions = await TaskService.getMySessions();
      setState(() { _sessions = sessions; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('History')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(_error!, style: const TextStyle(color: AppColors.error)),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ]))
                : _sessions.isEmpty
                    ? const Center(child: _EmptyState())
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _sessions.length,
                        itemBuilder: (_, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _SessionCard(session: _sessions[i]),
                        ),
                      ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  final TaskSession session;

  const _SessionCard({required this.session});

  Color get _statusColor => switch (session.status) {
        'completed' => AppColors.success,
        'active' => AppColors.primary,
        'paused' => AppColors.warning,
        _ => AppColors.gray400,
      };

  Color get _statusBg => switch (session.status) {
        'completed' => AppColors.successLight,
        'active' => AppColors.primaryLight,
        'paused' => AppColors.warningLight,
        _ => AppColors.gray100,
      };

  @override
  Widget build(BuildContext context) {
    final duration = session.checkedOutAt != null
        ? session.checkedOutAt!.difference(session.checkedInAt)
        : DateTime.now().difference(session.checkedInAt);
    final mins = duration.inMinutes;
    final secs = duration.inSeconds % 60;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(
                'Session #${session.id.substring(0, 8)}...',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: _statusBg, borderRadius: BorderRadius.circular(20)),
              child: Text(
                session.status[0].toUpperCase() + session.status.substring(1),
                style: TextStyle(color: _statusColor, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            _InfoItem(label: 'Check In', value: _formatDateTime(session.checkedInAt)),
            if (session.checkedOutAt != null)
              _InfoItem(label: 'Check Out', value: _formatDateTime(session.checkedOutAt!)),
          ]),
          const SizedBox(height: 6),
          Row(children: [
            _InfoItem(label: 'Duration', value: '${mins}m ${secs}s'),
            if (session.earnings != null)
              _InfoItem(label: 'Earned', value: 'RM ${session.earnings!.toStringAsFixed(2)}'),
          ]),
          if (session.proofNotes != null && session.proofNotes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Notes: ${session.proofNotes}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.gray500), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ]),
      ),
    );
  }
}

class _InfoItem extends StatelessWidget {
  final String label;
  final String value;

  const _InfoItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Text('📊', style: TextStyle(fontSize: 48)),
      const SizedBox(height: 12),
      Text('No sessions yet', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 4),
      Text('Your completed tasks will appear here.', style: Theme.of(context).textTheme.bodySmall),
    ]);
  }
}

String _formatDateTime(DateTime dt) =>
    '${dt.day}/${dt.month}/${dt.year}\n${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
