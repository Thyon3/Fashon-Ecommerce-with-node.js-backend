import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class InputField extends StatelessWidget {
  final String? label;
  final String? hint;
  final String? initialValue;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final bool obscureText;
  final bool enabled;
  final bool readOnly;
  final int maxLines;
  final int? maxLength;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String?)? onSaved;
  final void Function()? onTap;
  final FocusNode? focusNode;
  final TextInputAction? textInputAction;
  final void Function(String)? onSubmitted;
  final List<TextInputFormatter>? inputFormatters;
  final EdgeInsetsGeometry? contentPadding;
  final InputBorder? border;
  final InputBorder? enabledBorder;
  final InputBorder? focusedBorder;
  final InputBorder? errorBorder;
  final TextStyle? style;
  final TextStyle? labelStyle;
  final TextStyle? hintStyle;
  final Color? fillColor;
  final bool filled;
  final String? errorText;
  final AutovalidateMode? autovalidateMode;

  const InputField({
    super.key,
    this.label,
    this.hint,
    this.initialValue,
    this.controller,
    this.keyboardType = TextInputType.text,
    this.obscureText = false,
    this.enabled = true,
    this.readOnly = false,
    this.maxLines = 1,
    this.maxLength,
    this.prefixIcon,
    this.suffixIcon,
    this.validator,
    this.onChanged,
    this.onSaved,
    this.onTap,
    this.focusNode,
    this.textInputAction,
    this.onSubmitted,
    this.inputFormatters,
    this.contentPadding,
    this.border,
    this.enabledBorder,
    this.focusedBorder,
    this.errorBorder,
    this.style,
    this.labelStyle,
    this.hintStyle,
    this.fillColor,
    this.filled = false,
    this.errorText,
    this.autovalidateMode,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      initialValue: initialValue,
      keyboardType: keyboardType,
      obscureText: obscureText,
      enabled: enabled,
      readOnly: readOnly,
      maxLines: maxLines,
      maxLength: maxLength,
      validator: validator,
      onChanged: onChanged,
      onSaved: onSaved,
      onTap: onTap,
      focusNode: focusNode,
      textInputAction: textInputAction,
      onFieldSubmitted: onSubmitted,
      inputFormatters: inputFormatters,
      autovalidateMode: autovalidateMode,
      style: style ?? Theme.of(context).textTheme.bodyMedium,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: prefixIcon,
        suffixIcon: suffixIcon,
        errorText: errorText,
        contentPadding: contentPadding ?? const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
        border: border ?? OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        enabledBorder: enabledBorder ?? OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.outline,
          ),
        ),
        focusedBorder: focusedBorder ?? OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.primary,
            width: 2,
          ),
        ),
        errorBorder: errorBorder ?? OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Colors.red),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Colors.red, width: 2),
        ),
        labelStyle: labelStyle ?? Theme.of(context).inputDecorationTheme.labelStyle,
        hintStyle: hintStyle ?? Theme.of(context).inputDecorationTheme.hintStyle,
        fillColor: fillColor,
        filled: filled,
      ),
    );
  }
}

// Custom search input field
class SearchInputField extends StatelessWidget {
  final String? hint;
  final TextEditingController? controller;
  final void Function(String)? onChanged;
  final void Function()? onClear;
  final VoidCallback? onTap;
  final bool enabled;
  final FocusNode? focusNode;

  const SearchInputField({
    super.key,
    this.hint,
    this.controller,
    this.onChanged,
    this.onClear,
    this.onTap,
    this.enabled = true,
    this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      onTap: onTap,
      enabled: enabled,
      focusNode: focusNode,
      decoration: InputDecoration(
        hintText: hint ?? 'Search...',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: controller != null && controller!.text.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  controller!.clear();
                  onClear?.call();
                },
              )
            : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(25),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(25),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.outline,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(25),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.primary,
            width: 2,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
      ),
    );
  }
}

// Password input field with visibility toggle
class PasswordInputField extends StatefulWidget {
  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String?)? onSaved;
  final FocusNode? focusNode;

  const PasswordInputField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.validator,
    this.onChanged,
    this.onSaved,
    this.focusNode,
  });

  @override
  State<PasswordInputField> createState() => _PasswordInputFieldState();
}

class _PasswordInputFieldState extends State<PasswordInputField> {
  bool _obscureText = true;

  @override
  Widget build(BuildContext context) {
    return InputField(
      label: widget.label ?? 'Password',
      hint: widget.hint ?? 'Enter your password',
      controller: widget.controller,
      obscureText: _obscureText,
      validator: widget.validator,
      onChanged: widget.onChanged,
      onSaved: widget.onSaved,
      focusNode: widget.focusNode,
      suffixIcon: IconButton(
        icon: Icon(
          _obscureText ? Icons.visibility_off : Icons.visibility,
        ),
        onPressed: () {
          setState(() => _obscureText = !_obscureText);
        },
      ),
    );
  }
}

// Email input field with email validation
class EmailInputField extends StatelessWidget {
  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String?)? onSaved;
  final FocusNode? focusNode;

  const EmailInputField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.validator,
    this.onChanged,
    this.onSaved,
    this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return InputField(
      label: widget.label ?? 'Email',
      hint: widget.hint ?? 'Enter your email',
      controller: widget.controller,
      keyboardType: TextInputType.emailAddress,
      prefixIcon: const Icon(Icons.email_outlined),
      validator: widget.validator ?? (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your email';
        }
        if (!value.isEmail) {
          return 'Please enter a valid email';
        }
        return null;
      },
      onChanged: widget.onChanged,
      onSaved: widget.onSaved,
      focusNode: widget.focusNode,
    );
  }
}

// Phone input field with phone validation
class PhoneInputField extends StatelessWidget {
  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String?)? onSaved;
  final FocusNode? focusNode;

  const PhoneInputField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.validator,
    this.onChanged,
    this.onSaved,
    this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return InputField(
      label: widget.label ?? 'Phone',
      hint: widget.hint ?? 'Enter your phone number',
      controller: widget.controller,
      keyboardType: TextInputType.phone,
      prefixIcon: const Icon(Icons.phone_outlined),
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
      ],
      validator: widget.validator ?? (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your phone number';
        }
        if (!value.isPhoneNumber) {
          return 'Please enter a valid phone number';
        }
        return null;
      },
      onChanged: widget.onChanged,
      onSaved: widget.onSaved,
      focusNode: widget.focusNode,
    );
  }
}
