import 'package:flutter/material.dart';

class VerticalLabelField extends StatelessWidget {
  final String label;
  final String? hintText;
  final Widget? child;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final bool obscureText;
  final String? Function(String?)? validator;
  final VoidCallback? onTap;
  final bool readOnly;
  final int maxLines;
  final InputDecoration? decoration;
  final TextStyle? style;
  final EdgeInsetsGeometry? contentPadding;

  const VerticalLabelField({
    super.key,
    required this.label,
    this.hintText,
    this.child,
    this.controller,
    this.keyboardType,
    this.obscureText = false,
    this.validator,
    this.onTap,
    this.readOnly = false,
    this.maxLines = 1,
    this.decoration,
    this.style,
    this.contentPadding,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Label
        Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 8),
        
        // Field
        child ?? TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          validator: validator,
          onTap: onTap,
          readOnly: readOnly,
          maxLines: maxLines,
          style: style ?? const TextStyle(
            fontSize: 16,
            color: Colors.black87,
          ),
          decoration: decoration ?? InputDecoration(
            hintText: hintText,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Colors.grey),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Colors.grey),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Colors.blue, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Colors.red),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Colors.red, width: 2),
            ),
            contentPadding: contentPadding ?? const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
            hintStyle: const TextStyle(
              color: Colors.grey,
              fontSize: 16,
            ),
          ),
        ),
      ],
    );
  }
}

// Custom vertical label field for better customization
class CustomVerticalLabelField extends StatelessWidget {
  final String label;
  final Widget child;
  final EdgeInsetsGeometry? labelPadding;
  final EdgeInsetsGeometry? fieldPadding;
  final CrossAxisAlignment labelCrossAxisAlignment;

  const CustomVerticalLabelField({
    super.key,
    required this.label,
    required this.child,
    this.labelPadding,
    this.fieldPadding,
    this.labelCrossAxisAlignment = CrossAxisAlignment.start,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: fieldPadding ?? EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: labelCrossAxisAlignment,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Label
          Padding(
            padding: labelPadding ?? const EdgeInsets.only(bottom: 8),
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.black87,
              ),
            ),
          ),
          
          // Field
          child,
        ],
      ),
    );
  }
}
