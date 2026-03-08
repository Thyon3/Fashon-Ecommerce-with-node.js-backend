import 'package:equatable/equatable.dart';

class ServerException extends Equatable implements Exception {
  ServerException({required this.message, required this.statusCode, this.errorCode});

  final String message;
  final String statusCode;
  final String? errorCode;

  @override
  List<Object?> get props => [message, statusCode, errorCode];

  @override
  String toString() => 'ServerException: $message (Status: $statusCode${errorCode != null ? ', Code: $errorCode' : ''})';
}

class CacheException extends Equatable implements Exception {
  CacheException({required this.message, this.key});

  final String message;
  final String? key;

  @override
  List<Object?> get props => [message, key];

  @override
  String toString() => 'CacheException: $message${key != null ? ' (Key: $key)' : ''}';
}

class NetworkException extends Equatable implements Exception {
  NetworkException({required this.message, this.statusCode});

  final String message;
  final String? statusCode;

  @override
  List<Object?> get props => [message, statusCode];

  @override
  String toString() => 'NetworkException: $message${statusCode != null ? ' (Status: $statusCode)' : ''}';
}

class ValidationException extends Equatable implements Exception {
  ValidationException({required this.message, this.field});

  final String message;
  final String? field;

  @override
  List<Object?> get props => [message, field];

  @override
  String toString() => 'ValidationException: $message${field != null ? ' (Field: $field)' : ''}';
}

class AuthenticationException extends Equatable implements Exception {
  AuthenticationException({required this.message, this.type});

  final String message;
  final String? type;

  @override
  List<Object?> get props => [message, type];

  @override
  String toString() => 'AuthenticationException: $message${type != null ? ' (Type: $type)' : ''}';
}

class PermissionException extends Equatable implements Exception {
  PermissionException({required this.message, this.resource});

  final String message;
  final String? resource;

  @override
  List<Object?> get props => [message, resource];

  @override
  String toString() => 'PermissionException: $message${resource != null ? ' (Resource: $resource)' : ''}';
}

class TimeoutException extends Equatable implements Exception {
  TimeoutException({required this.message, this.duration});

  final String message;
  final Duration? duration;

  @override
  List<Object?> get props => [message, duration];

  @override
  String toString() => 'TimeoutException: $message${duration != null ? ' (Duration: $duration)' : ''}';
}

class DataParsingException extends Equatable implements Exception {
  DataParsingException({required this.message, this.dataType});

  final String message;
  final String? dataType;

  @override
  List<Object?> get props => [message, dataType];

  @override
  String toString() => 'DataParsingException: $message${dataType != null ? ' (Type: $dataType)' : ''}';
}
