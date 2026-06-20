import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../providers/task_provider.dart';

const _kCategories = [
  'Cleaning', 'Delivery', 'Driving', 'Moving', 'Gardening',
  'Cooking', 'Tech Support', 'Tutoring', 'Painting', 'Plumbing', 'Other',
];

class FilterBottomSheet extends StatefulWidget {
  final TaskFilters current;

  const FilterBottomSheet({super.key, required this.current});

  @override
  State<FilterBottomSheet> createState() => _FilterBottomSheetState();
}

class _FilterBottomSheetState extends State<FilterBottomSheet> {
  late final _locationCtrl = TextEditingController(text: widget.current.location ?? '');
  String? _category;
  final _minPayCtrl = TextEditingController(text: widget.current.minPay?.toString() ?? '');
  final _maxPayCtrl = TextEditingController(text: widget.current.maxPay?.toString() ?? '');

  @override
  void initState() {
    super.initState();
    _category = widget.current.category;
  }

  @override
  void dispose() {
    _locationCtrl.dispose();
    _minPayCtrl.dispose();
    _maxPayCtrl.dispose();
    super.dispose();
  }

  void _apply() {
    final filters = TaskFilters(
      location: _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
      category: _category,
      minPay: double.tryParse(_minPayCtrl.text),
      maxPay: double.tryParse(_maxPayCtrl.text),
    );
    Navigator.of(context).pop(filters);
  }

  void _clear() {
    Navigator.of(context).pop(const TaskFilters());
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Handle
        Center(
          child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.gray200, borderRadius: BorderRadius.circular(2))),
        ),
        const SizedBox(height: 16),
        Row(children: [
          Text('Filters', style: Theme.of(context).textTheme.titleLarge),
          const Spacer(),
          TextButton(onPressed: _clear, child: const Text('Clear all')),
        ]),
        const SizedBox(height: 16),

        // Location
        TextFormField(
          controller: _locationCtrl,
          decoration: const InputDecoration(labelText: 'Location', prefixIcon: Icon(Icons.location_on_outlined), hintText: 'e.g. Kuala Lumpur'),
        ),
        const SizedBox(height: 16),

        // Category
        DropdownButtonFormField<String>(
          value: _category,
          decoration: const InputDecoration(labelText: 'Category', prefixIcon: Icon(Icons.category_outlined)),
          items: [
            const DropdownMenuItem(value: null, child: Text('All categories')),
            ..._kCategories.map((c) => DropdownMenuItem(value: c, child: Text(c))),
          ],
          onChanged: (v) => setState(() => _category = v),
        ),
        const SizedBox(height: 16),

        // Pay range
        Row(children: [
          Expanded(
            child: TextFormField(
              controller: _minPayCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Min Pay (RM)', prefixIcon: Icon(Icons.attach_money)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextFormField(
              controller: _maxPayCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Max Pay (RM)', prefixIcon: Icon(Icons.attach_money)),
            ),
          ),
        ]),
        const SizedBox(height: 24),

        ElevatedButton(onPressed: _apply, child: const Text('Apply Filters')),
      ]),
    );
  }
}
