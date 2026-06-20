import 'package:flutter/foundation.dart';
import '../models/message.dart';
import '../services/message_service.dart';

class MessageProvider extends ChangeNotifier {
  List<Conversation> _conversations = [];
  List<Message> _currentMessages = [];
  String? _currentUserId;
  bool _loading = false;
  int _unreadCount = 0;

  List<Conversation> get conversations => _conversations;
  List<Message> get currentMessages => _currentMessages;
  bool get loading => _loading;
  int get unreadCount => _unreadCount;

  Future<void> loadConversations() async {
    _loading = true;
    notifyListeners();
    try {
      _conversations = await MessageService.getConversations();
    } catch (_) {}
    _loading = false;
    notifyListeners();
  }

  Future<void> loadConversation(String userId) async {
    _currentUserId = userId;
    _loading = true;
    notifyListeners();
    try {
      _currentMessages = await MessageService.getConversation(userId);
    } catch (_) {}
    _loading = false;
    notifyListeners();
  }

  Future<void> sendMessage(String recipientId, String body) async {
    final msg = await MessageService.sendMessage(recipientId, body);
    _currentMessages = [..._currentMessages, msg];
    notifyListeners();
    // Refresh conversations to update last message
    loadConversations();
  }

  Future<void> refreshUnreadCount() async {
    _unreadCount = await MessageService.getUnreadCount();
    notifyListeners();
  }

  Future<void> deleteMessage(String messageId) async {
    await MessageService.deleteMessage(messageId);
    _currentMessages = _currentMessages.where((m) => m.id != messageId).toList();
    notifyListeners();
  }
}
