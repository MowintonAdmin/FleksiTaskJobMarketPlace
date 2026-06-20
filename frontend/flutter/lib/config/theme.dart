import 'package:flutter/material.dart';

const _primarySwatch = Color(0xFF6366F1); // indigo-500

final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: _primarySwatch,
    brightness: Brightness.light,
  ),
  scaffoldBackgroundColor: const Color(0xFFF9FAFB),
  appBarTheme: const AppBarTheme(
    backgroundColor: Colors.white,
    foregroundColor: Color(0xFF111827),
    elevation: 0,
    centerTitle: false,
    titleTextStyle: TextStyle(
      color: Color(0xFF111827),
      fontWeight: FontWeight.w700,
      fontSize: 18,
    ),
  ),
  cardTheme: CardTheme(
    color: Colors.white,
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: const BorderSide(color: Color(0xFFE5E7EB)),
    ),
    margin: EdgeInsets.zero,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: _primarySwatch, width: 2),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: _primarySwatch,
      foregroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.symmetric(vertical: 14),
      textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      elevation: 0,
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: _primarySwatch,
      side: const BorderSide(color: _primarySwatch),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.symmetric(vertical: 14),
      textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: _primarySwatch,
      textStyle: const TextStyle(fontWeight: FontWeight.w600),
    ),
  ),
  chipTheme: ChipThemeData(
    backgroundColor: const Color(0xFFEEF2FF),
    labelStyle: const TextStyle(color: _primarySwatch, fontSize: 12),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
  ),
  dividerTheme: const DividerThemeData(color: Color(0xFFE5E7EB), thickness: 1),
  textTheme: const TextTheme(
    headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
    titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
    titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
    bodyMedium: TextStyle(fontSize: 14, color: Color(0xFF374151)),
    bodySmall: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
  ),
);

class AppColors {
  static const primary = _primarySwatch;
  static const primaryLight = Color(0xFFEEF2FF);
  static const success = Color(0xFF10B981);
  static const successLight = Color(0xFFD1FAE5);
  static const warning = Color(0xFFF59E0B);
  static const warningLight = Color(0xFFFEF3C7);
  static const error = Color(0xFFEF4444);
  static const errorLight = Color(0xFFFEE2E2);
  static const gray50 = Color(0xFFF9FAFB);
  static const gray100 = Color(0xFFF3F4F6);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray400 = Color(0xFF9CA3AF);
  static const gray500 = Color(0xFF6B7280);
  static const gray700 = Color(0xFF374151);
  static const gray900 = Color(0xFF111827);
}
