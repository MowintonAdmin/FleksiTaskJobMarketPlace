import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/message_provider.dart';
import '../home/home_screen.dart';
import '../applications/my_applications_screen.dart';
import '../messages/messages_screen.dart';
import '../wallet/wallet_screen.dart';
import '../profile/profile_screen.dart';
import '../history/history_screen.dart';

class MainShell extends StatefulWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  static const _tabs = [
    (path: '/', label: 'Home', icon: Icons.home_outlined, activeIcon: Icons.home),
    (path: '/my-applications', label: 'Applied', icon: Icons.list_alt_outlined, activeIcon: Icons.list_alt),
    (path: '/messages', label: 'Messages', icon: Icons.chat_bubble_outline, activeIcon: Icons.chat_bubble),
    (path: '/wallet', label: 'Wallet', icon: Icons.account_balance_wallet_outlined, activeIcon: Icons.account_balance_wallet),
    (path: '/profile', label: 'Profile', icon: Icons.person_outlined, activeIcon: Icons.person),
  ];

  @override
  void initState() {
    super.initState();
    // Poll unread count periodically
    Future.delayed(const Duration(seconds: 2), _pollUnread);
  }

  Future<void> _pollUnread() async {
    if (!mounted) return;
    await context.read<MessageProvider>().refreshUnreadCount();
    if (mounted) Future.delayed(const Duration(seconds: 30), _pollUnread);
  }

  void _onTabTapped(int index) {
    setState(() => _currentIndex = index);
    context.go(_tabs[index].path);
  }

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<MessageProvider>().unreadCount;

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.gray400,
        selectedLabelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: const TextStyle(fontSize: 11),
        backgroundColor: Colors.white,
        elevation: 8,
        items: _tabs.asMap().entries.map((e) {
          final i = e.key;
          final tab = e.value;
          final isMessages = i == 2;
          return BottomNavigationBarItem(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(i == _currentIndex ? tab.activeIcon : tab.icon),
                if (isMessages && unread > 0)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                      child: Center(
                        child: Text(
                          unread > 9 ? '9+' : '$unread',
                          style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            label: tab.label,
          );
        }).toList(),
      ),
    );
  }
}
