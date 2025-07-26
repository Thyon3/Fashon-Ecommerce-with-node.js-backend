import 'package:equatable/equatable.dart';
import 'package:frontend/core/util/constants/typedefs.dart';

class ErrorResponse extends Equatable {
  ErrorResponse({this.type, this.message, this.errorMessages});

  factory ErrorResponse.fromMap(DataMap map) {
    var errorMessage =
        (map as List?)
            ?.cast<DataMap>()
            .map((error) => error['messages'] as String)
            .toList();
    if (errorMessage != null && errorMessage.isEmpty) errorMessage = null;
    return ErrorResponse(
      type: map['type'] as String?,
      message: map['message'] as String?,
      errorMessages: errorMessage,
    );
  }
  final String? type;
  final String? message;
  final List<String>? errorMessages;

  String get errorMessage {
    var payload = '';
    if (type != null) payload = '${type!}\n';
    if (message != null) {
      payload += message!;
    } else {
      if (errorMessages != null) {
        payload += '\nWhat went wrong?';
        for (final (index, message) in errorMessages!.indexed) {
          if (index == 0) {
            payload += '\n$message';
          } else {
            payload += '\n\n$message';
          }
        }
      }
    }
    return payload;
  }

  @override
  List<Object?> get props => throw UnimplementedError();
}
