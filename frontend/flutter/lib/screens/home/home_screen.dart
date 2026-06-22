import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/task.dart';
import '../../providers/auth_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/wallet_provider.dart';
import '../../widgets/task_card.dart';
import '../../widgets/filter_bottom_sheet.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TaskProvider>().fetchTasks();
      final auth = context.read<AuthProvider>();
      if (auth.isLoggedIn) {
        context.read<WalletProvider>().load();
      }
    });
  }

  void _openFilters() async {
    final taskProv = context.read<TaskProvider>();
    final result = await showModalBottomSheet<TaskFilters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FilterBottomSheet(current: taskProv.filters),
    );
    if (result != null) {
      taskProv.fetchTasks(filters: result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final taskProv = context.watch<TaskProvider>();
    final authProv = context.watch<AuthProvider>();
    final walletProv = context.watch<WalletProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('FlekxiTask'),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.tune_rounded),
                tooltip: 'Filters',
                onPressed: _openFilters,
              ),
              if (taskProv.filters.hasFilters)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => taskProv.fetchTasks(page: 1),
        child: CustomScrollView(
          slivers: [
            // Wallet Banner
            if (authProv.isLoggedIn && walletProv.wallet != null)
              SliverToBoxAdapter(
                child: _WalletBanner(
                  available: walletProv.wallet!.availableBalance,
                  pending: walletProv.wallet!.pendingBalance,
                  onTap: () => context.go('/wallet'),
                ),
              ),

            // Hero
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Find Flexible Work', style: Theme.of(context).textTheme.headlineMedium),
                  RichText(
                    text: const TextSpan(
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
                      children: [
                        TextSpan(text: 'Near '),
                        TextSpan(text: 'You', style: TextStyle(color: AppColors.primary)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Browse tasks, apply in one tap, and start earning today.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.gray500),
                  ),
                ]),
              ),
            ),

            // Active filter chips
            if (taskProv.filters.hasFilters)
              SliverToBoxAdapter(child: _ActiveFilters(filters: taskProv.filters, onClear: () => taskProv.fetchTasks(filters: const TaskFilters()))),

            // Results count
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Text(
                  taskProv.loading ? 'Loading...' : '${taskProv.total} task${taskProv.total != 1 ? "s" : ""} available',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ),

            // Error
            if (taskProv.error != null)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(12)),
                  child: Text(taskProv.error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
                ),
              ),

            // Task Grid
            if (taskProv.loading)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => const _TaskSkeleton(),
                    childCount: 6,
                  ),
                ),
              )
            else if (taskProv.items.isEmpty)
              const SliverFillRemaining(child: _EmptyState())
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TaskCard(task: taskProv.items[i], onTap: () => context.push('/tasks/${taskProv.items[i].id}')),
                    ),
                    childCount: taskProv.items.length,
                  ),
                ),
              ),

            // Pagination
            if (taskProv.totalPages > 1)
              SliverToBoxAdapter(child: _Pagination(taskProv: taskProv)),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}

// ── Wallet Banner ──────────────────────────────────────────────────────────
class _WalletBanner extends StatelessWidget {
  final double available;
  final double pending;
  final VoidCallback onTap;

  const _WalletBanner({required this.available, required this.pending, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF6366F1), Color(0xFF4F46E5)],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('My Wallet', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w500)),
              Text('RM ${available.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700)),
              if (pending > 0)
                Text('⏳ RM ${pending.toStringAsFixed(2)} pending', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ]),
          ),
          const Column(children: [
            Text('💰', style: TextStyle(fontSize: 28)),
            SizedBox(height: 4),
            Text('View →', style: TextStyle(color: Colors.white70, fontSize: 12)),
          ]),
        ]),
      ),
    );
  }
}

// ── Active Filter Chips ────────────────────────────────────────────────────
class _ActiveFilters extends StatelessWidget {
  final TaskFilters filters;
  final VoidCallback onClear;

  const _ActiveFilters({required this.filters, required this.onClear});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Wrap(
        spacing: 8,
        runSpacing: 4,
        children: [
          if (filters.location != null)
            Chip(label: Text('📍 ${filters.location}'), onDeleted: onClear, deleteIcon: const Icon(Icons.close, size: 14)),
          if (filters.category != null)
            Chip(label: Text(filters.category!), onDeleted: onClear, deleteIcon: const Icon(Icons.close, size: 14)),
          TextButton(onPressed: onClear, child: const Text('Clear all')),
        ],
      ),
    );
  }
}

// ── Pagination ─────────────────────────────────────────────────────────────
class _Pagination extends StatelessWidget {
  final TaskProvider taskProv;

  const _Pagination({required this.taskProv});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        OutlinedButton(
          onPressed: taskProv.page <= 1 ? null : () => taskProv.fetchTasks(page: taskProv.page - 1),
          child: const Text('← Prev'),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text('${taskProv.page} / ${taskProv.totalPages}', style: Theme.of(context).textTheme.bodySmall),
        ),
        OutlinedButton(
          onPressed: taskProv.page >= taskProv.totalPages ? null : () => taskProv.fetchTasks(page: taskProv.page + 1),
          child: const Text('Next →'),
        ),
      ]),
    );
  }
}

// ── Skeleton ───────────────────────────────────────────────────────────────
class _TaskSkeleton extends StatelessWidget {
  const _TaskSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      height: 120,
      decoration: BoxDecoration(color: AppColors.gray100, borderRadius: BorderRadius.circular(16)),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Text('🔍', style: TextStyle(fontSize: 48)),
        const SizedBox(height: 12),
        Text('No tasks found', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('Try adjusting your filters', style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}
