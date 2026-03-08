import 'package:frontend/core/src/auth/domain/entities/user.dart';

abstract class AuthState {}

class AuthInitial extends AuthState {
  @override
  bool operator ==(Object other) => identical(this, other) || other is AuthInitial;
  
  @override
  int get hashCode => runtimeType.hashCode;
}

class AuthLoading extends AuthState {
  @override
  bool operator ==(Object other) => identical(this, other) || other is AuthLoading;
  
  @override
  int get hashCode => runtimeType.hashCode;
}

class Authenticated extends AuthState {
  final User user;
  
  const Authenticated(this.user);
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Authenticated && other.user == user;
  }
  
  @override
  int get hashCode => user.hashCode;
  
  @override
  String toString() => 'Authenticated(user: $user)';
}

class Unauthenticated extends AuthState {
  final String? message;
  
  const Unauthenticated([this.message]);
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Unauthenticated && other.message == message;
  }
  
  @override
  int get hashCode => message.hashCode;
  
  @override
  String toString() => 'Unauthenticated(message: $message)';
}

class AuthError extends AuthState {
  final String message;
  final String? errorType;
  
  const AuthError(this.message, [this.errorType]);
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is AuthError && 
           other.message == message && 
           other.errorType == errorType;
  }
  
  @override
  int get hashCode => message.hashCode ^ errorType.hashCode;
  
  @override
  String toString() => 'AuthError(message: $message, errorType: $errorType)';
}

class PasswordResetSent extends AuthState {
  final String email;
  
  const PasswordResetSent(this.email);
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is PasswordResetSent && other.email == email;
  }
  
  @override
  int get hashCode => email.hashCode;
  
  @override
  String toString() => 'PasswordResetSent(email: $email)';
}

class OtpVerified extends AuthState {
  final String email;
  
  const OtpVerified(this.email);
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is OtpVerified && other.email == email;
  }
  
  @override
  int get hashCode => email.hashCode;
  
  @override
  String toString() => 'OtpVerified(email: $email)';
}
