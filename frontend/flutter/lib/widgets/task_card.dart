import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/task.dart';

class TaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback? onTap;

  const TaskCard({super.key, required this.task, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              _StatusChip(status: task.status),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppColors.gray100, borderRadius: BorderRadius.circular(20)),
                child: Text(task.category, style: Theme.of(context).textTheme.bodySmall),
              ),
              const Spacer(),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('RM ${task.totalPay.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.primary)),
                Text('RM ${task.payRatePerMinute}/min', style: Theme.of(context).textTheme.bodySmall),
              ]),
            ]),
            const SizedBox(height: 10),
            Text(task.title, style: Theme.of(context).textTheme.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Row(children: [
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.gray400),
              const SizedBox(width: 4),
              Expanded(child: Text(task.location, style: Theme.of(context).textTheme.bodySmall, overflow: TextOverflow.ellipsis)),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              _InfoChip(icon: Icons.timer_outlined, label: '${task.estimatedDurationMinutes} min'),
              const SizedBox(width: 8),
              _InfoChip(icon: Icons.people_outline, label: '${task.applicationCount}/${task.maxApplicants}'),
              if (task.startsAt != null) ...[
                const SizedBox(width: 8),
                _InfoChip(icon: Icons.calendar_today_outlined, label: _formatDate(task.startsAt!)),
              ],
            ]),
          ]),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'open':
        bg = AppColors.successLight;
        fg = AppColors.success;
        break;
      case 'in_progress':
        bg = AppColors.warningLight;
        fg = AppColors.warning;
        break;
      default:
        bg = AppColors.gray100;
        fg = AppColors.gray500;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 13, color: AppColors.gray400),
      const SizedBox(width: 3),
      Text(label, style: Theme.of(context).textTheme.bodySmall),
    ]);
  }
}

String _formatDate(DateTime dt) {
  final now = DateTime.now();
  if (dt.year == now.year && dt.month == now.month && dt.day == now.day) return 'Today';
  return '${dt.day}/${dt.month}';
}
