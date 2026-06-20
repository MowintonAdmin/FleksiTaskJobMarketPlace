class Message {
  final String id;
  final String senderId;
  final String recipientId;
  final String body;
  final DateTime createdAt;
  final bool isRead;

  const Message({
    required this.id,
    required this.senderId,
    required this.recipientId,
    required this.body,
    required this.createdAt,
    this.isRead = false,
  });

  factory Message.fromJson(Map<String, dynamic> j) => Message(
        id: j['id']?.toString() ?? '',
        senderId: j['sender_id']?.toString() ?? '',
        recipientId: j['recipient_id']?.toString() ?? '',
        body: j['body'] ?? '',
        createdAt: j['created_at'] != null ? _parseUtc(j['created_at']) : DateTime.now(),
        isRead: j['is_read'] ?? false,
      );
}

class Conversation {
  final String userId;
  final String userName;
  final String? userPhoto;
  final String? lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;

  const Conversation({
    required this.userId,
    required this.userName,
    this.userPhoto,
    this.lastMessage,
    this.lastMessageAt,
    this.unreadCount = 0,
  });

  factory Conversation.fromJson(Map<String, dynamic> j) => Conversation(
        userId: j['user_id']?.toString() ?? '',
        userName: j['user_name'] ?? '',
        userPhoto: j['user_photo'],
        lastMessage: j['last_message'],
        lastMessageAt: j['last_message_at'] != null ? _parseUtc(j['last_message_at']) : null,
        unreadCount: (j['unread_count'] as num?)?.toInt() ?? 0,
      );
}

DateTime _parseUtc(String s) {
  if (!s.endsWith('Z') && !RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(s)) {
    s = '${s}Z';
  }
  return DateTime.parse(s).toLocal();
}
