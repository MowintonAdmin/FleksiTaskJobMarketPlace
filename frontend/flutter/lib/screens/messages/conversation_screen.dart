import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/message.dart';
import '../../providers/auth_provider.dart';
import '../../providers/message_provider.dart';

class ConversationScreen extends StatefulWidget {
  final String userId;
  final String userName;
  final String? userPhoto;

  const ConversationScreen({
    super.key,
    required this.userId,
    required this.userName,
    this.userPhoto,
  });

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MessageProvider>().loadConversation(widget.userId);
    });
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _msgCtrl.text.trim();
    if (body.isEmpty) return;
    _msgCtrl.clear();
    setState(() => _sending = true);
    try {
      await context.read<MessageProvider>().sendMessage(widget.userId, body);
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final msgProv = context.watch<MessageProvider>();
    final myId = context.read<AuthProvider>().user?.id ?? '';
    final messages = msgProv.currentMessages;

    // Auto-scroll when new messages arrive
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          _Avatar(name: widget.userName, photoUrl: widget.userPhoto),
          const SizedBox(width: 10),
          Text(widget.userName),
        ]),
      ),
      body: Column(children: [
        // Messages list
        Expanded(
          child: msgProv.loading
              ? const Center(child: CircularProgressIndicator())
              : messages.isEmpty
                  ? const Center(child: Text('No messages yet. Say hello! 👋'))
                  : ListView.builder(
                      controller: _scrollCtrl,
                      padding: const EdgeInsets.all(16),
                      itemCount: messages.length,
                      itemBuilder: (_, i) {
                        final msg = messages[i];
                        final isMe = msg.senderId == myId;
                        return _MessageBubble(msg: msg, isMe: isMe);
                      },
                    ),
        ),

        // Input
        Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.gray200)),
          ),
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: SafeArea(
            top: false,
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                  decoration: InputDecoration(
                    hintText: 'Type a message...',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: AppColors.gray200),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: AppColors.gray200),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _sending ? null : _send,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: _sending
                      ? const Padding(
                          padding: EdgeInsets.all(10),
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                ),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message msg;
  final bool isMe;

  const _MessageBubble({required this.msg, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isMe ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: isMe ? const Radius.circular(18) : const Radius.circular(4),
              bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(18),
            ),
            border: isMe ? null : Border.all(color: AppColors.gray200),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(msg.body, style: TextStyle(color: isMe ? Colors.white : AppColors.gray900, fontSize: 14)),
            const SizedBox(height: 4),
            Text(
              '${msg.createdAt.hour.toString().padLeft(2, '0')}:${msg.createdAt.minute.toString().padLeft(2, '0')}',
              style: TextStyle(color: isMe ? Colors.white70 : AppColors.gray400, fontSize: 10),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String? photoUrl;

  const _Avatar({required this.name, this.photoUrl});

  @override
  Widget build(BuildContext context) {
    if (photoUrl != null) return CircleAvatar(backgroundImage: NetworkImage(photoUrl!), radius: 16);
    return CircleAvatar(
      radius: 16,
      backgroundColor: AppColors.primaryLight,
      child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w700)),
    );
  }
}
