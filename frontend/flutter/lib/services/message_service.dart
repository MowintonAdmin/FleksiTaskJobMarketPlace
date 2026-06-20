import '../core/api_client.dart';
import '../models/message.dart';

class MessageService {
  static final _dio = ApiClient.instance;

  static Future<List<Conversation>> getConversations() async {
    final resp = await _dio.get('/messages/conversations');
    return (resp.data as List).map((e) => Conversation.fromJson(e)).toList();
  }

  static Future<List<Message>> getConversation(String userId) async {
    final resp = await _dio.get('/messages/conversation/$userId');
    return (resp.data as List).map((e) => Message.fromJson(e)).toList();
  }

  static Future<Message> sendMessage(String recipientId, String body) async {
    final resp = await _dio.post('/messages', data: {'recipient_id': recipientId, 'body': body});
    return Message.fromJson(resp.data);
  }

  static Future<int> getUnreadCount() async {
    try {
      final resp = await _dio.get('/messages/unread-count');
      return (resp.data['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      return 0;
    }
  }

  static Future<void> deleteMessage(String messageId) async {
    await _dio.delete('/messages/$messageId');
  }
}
