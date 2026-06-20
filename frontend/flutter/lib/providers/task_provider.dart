import 'package:flutter/foundation.dart';
import '../models/task.dart';
import '../services/task_service.dart';

class TaskFilters {
  final String? location;
  final String? category;
  final double? minPay;
  final double? maxPay;

  const TaskFilters({this.location, this.category, this.minPay, this.maxPay});

  TaskFilters copyWith({
    String? location,
    String? category,
    double? minPay,
    double? maxPay,
    bool clearLocation = false,
    bool clearCategory = false,
  }) =>
      TaskFilters(
        location: clearLocation ? null : (location ?? this.location),
        category: clearCategory ? null : (category ?? this.category),
        minPay: minPay ?? this.minPay,
        maxPay: maxPay ?? this.maxPay,
      );

  bool get hasFilters => location != null || category != null || minPay != null || maxPay != null;
}

class TaskProvider extends ChangeNotifier {
  List<Task> _items = [];
  Task? _selectedTask;
  bool _loading = false;
  String? _error;
  int _page = 1;
  int _totalPages = 1;
  int _total = 0;
  TaskFilters _filters = const TaskFilters();

  List<Task> get items => _items;
  Task? get selectedTask => _selectedTask;
  bool get loading => _loading;
  String? get error => _error;
  int get page => _page;
  int get totalPages => _totalPages;
  int get total => _total;
  TaskFilters get filters => _filters;

  Future<void> fetchTasks({TaskFilters? filters, int page = 1}) async {
    _loading = true;
    _error = null;
    if (filters != null) _filters = filters;
    notifyListeners();

    try {
      final result = await TaskService.listTasks(
        page: page,
        location: _filters.location,
        category: _filters.category,
        minPay: _filters.minPay,
        maxPay: _filters.maxPay,
      );
      _items = result['items'] as List<Task>;
      _total = result['total'] as int;
      _page = result['page'] as int;
      _totalPages = result['total_pages'] as int;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTask(String id) async {
    _loading = true;
    _selectedTask = null;
    notifyListeners();
    try {
      _selectedTask = await TaskService.getTask(id);
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void clearSelectedTask() {
    _selectedTask = null;
    notifyListeners();
  }
}
