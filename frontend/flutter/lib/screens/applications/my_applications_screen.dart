import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../models/application.dart';
import '../../services/task_service.dart';

class MyApplicationsScreen extends StatefulWidget {
  const MyApplicationsScreen({super.key});

  @override
  State<MyApplicationsScreen> createState() => _MyApplicationsScreenState();
}

class _MyApplicationsScreenState extends State<MyApplicationsScreen> {
  List<Application> _apps = [];
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
      final apps = await TaskService.getMyApplications();
      setState(() { _apps = apps; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Applications')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(_error!, style: const TextStyle(color: AppColors.error)),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ]))
                : _apps.isEmpty
                    ? _EmptyState()
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _apps.length,
                        itemBuilder: (_, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _ApplicationCard(app: _apps[i]),
                        ),
                      ),
      ),
    );
  }
}

class _ApplicationCard extends StatelessWidget {
  final Application app;

  const _ApplicationCard({required this.app});

  @override
  Widget build(BuildContext context) {
    final task = app.task;
    final statusColor = switch (app.status) {
      'accepted' => AppColors.success,
      'rejected' => AppColors.error,
      _ => AppColors.warning,
    };
    final statusBg = switch (app.status) {
      'accepted' => AppColors.successLight,
      'rejected' => AppColors.errorLight,
      _ => AppColors.warningLight,
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(task?.title ?? 'Task', style: Theme.of(context).textTheme.titleMedium, overflow: TextOverflow.ellipsis),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(20)),
              child: Text(
                app.status[0].toUpperCase() + app.status.substring(1),
                style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ]),
          if (task != null) ...[
            const SizedBox(height: 4),
            Text('📍 ${task.location}', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 2),
            Text('RM ${task.totalPay.toStringAsFixed(2)} · ${task.estimatedDurationMinutes} min', style: Theme.of(context).textTheme.bodySmall),
          ],
          if (app.coverNote != null && app.coverNote!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(app.coverNote!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.gray500), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 12),
          Row(children: [
            Text(_formatDate(app.createdAt), style: Theme.of(context).textTheme.bodySmall),
            const Spacer(),
            if (app.status == 'accepted' && task != null)
              ElevatedButton.icon(
                icon: const Icon(Icons.play_arrow, size: 16),
                label: const Text('Start Task'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: const TextStyle(fontSize: 13),
                  backgroundColor: AppColors.success,
                ),
                onPressed: () => context.push('/tracking/${app.id}'),
              ),
            if (task != null)
              TextButton(
                onPressed: () => context.push('/tasks/${task.id}'),
                child: const Text('View Task'),
              ),
          ]),
        ]),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Text('📋', style: TextStyle(fontSize: 48)),
        const SizedBox(height: 12),
        Text('No applications yet', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('Browse tasks and apply!', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: () => context.go('/'), child: const Text('Browse Tasks')),
      ]),
    );
  }
}

String _formatDate(DateTime dt) => '${dt.day}/${dt.month}/${dt.year}';
