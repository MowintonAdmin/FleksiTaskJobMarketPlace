import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/message.dart';
import '../../providers/auth_provider.dart';
import '../../providers/message_provider.dart';
import 'conversation_screen.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MessageProvider>().loadConversations();
    });
  }

  @override
  Widget build(BuildContext context) {
    final msgProv = context.watch<MessageProvider>();
    final myId = context.read<AuthProvider>().user?.id ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: RefreshIndicator(
        onRefresh: () => context.read<MessageProvider>().loadConversations(),
        child: msgProv.loading
            ? const Center(child: CircularProgressIndicator())
            : msgProv.conversations.isEmpty
                ? _EmptyState()
                : ListView.builder(
                    itemCount: msgProv.conversations.length,
                    itemBuilder: (_, i) => _ConversationTile(
                      conv: msgProv.conversations[i],
                      myId: myId,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ConversationScreen(
                            userId: msgProv.conversations[i].userId,
                            userName: msgProv.conversations[i].userName,
                            userPhoto: msgProv.conversations[i].userPhoto,
                          ),
                        ),
                      ),
                    ),
                  ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final Conversation conv;
  final String myId;
  final VoidCallback onTap;

  const _ConversationTile({required this.conv, required this.myId, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Stack(
        children: [
          _Avatar(name: conv.userName, photoUrl: conv.userPhoto),
          if (conv.unreadCount > 0)
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                width: 16,
                height: 16,
                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                child: Center(
                  child: Text(
                    conv.unreadCount > 9 ? '9+' : '${conv.unreadCount}',
                    style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
        ],
      ),
      title: Text(conv.userName, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: conv.lastMessage != null
          ? Text(conv.lastMessage!, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall)
          : null,
      trailing: conv.lastMessageAt != null
          ? Text(_formatTime(conv.lastMessageAt!), style: Theme.of(context).textTheme.bodySmall)
          : null,
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String? photoUrl;

  const _Avatar({required this.name, this.photoUrl});

  @override
  Widget build(BuildContext context) {
    if (photoUrl != null) {
      return CircleAvatar(backgroundImage: NetworkImage(photoUrl!), radius: 22);
    }
    return CircleAvatar(
      radius: 22,
      backgroundColor: AppColors.primaryLight,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Text('💬', style: TextStyle(fontSize: 48)),
        const SizedBox(height: 12),
        Text('No messages yet', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('When someone messages you, it\'ll appear here.', style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}

String _formatTime(DateTime dt) {
  final now = DateTime.now();
  final diff = now.difference(dt).inDays;
  if (diff == 0) return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  if (diff == 1) return 'Yesterday';
  if (diff < 7) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dt.weekday - 1];
  return '${dt.day}/${dt.month}';
}
