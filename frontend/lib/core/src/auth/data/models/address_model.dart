import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:frontend/core/common/entities/address.dart';

class AddressModel extends Address {
  AddressModel({
    super.street,
    super.apartment,
    super.postalCode,
    super.city,
    super.country,
  });
  @override
  // TODO: implement props
  List<Object?> get props => [street, apartment, postalCode, country, city];

  AddressModel.empty()
    : super(
        apartment: 'test apartment',
        city: 'tets city',
        country: 'test country',
        postalCode: 'postal code ',
        street: 'test street',
      );

  Map<String, dynamic> toMap() {
    return {
      'apartment': apartment,
      'city': city,
      'country': country,
      'postalCode': postalCode,
      'street': street,
    };
  }

  factory AddressModel.fromMap(Map<String, dynamic> map) {
    return AddressModel(
      apartment: map['apartment'] as String,
      city: map['city'] as String,
      country: map['country'] as String,
      postalCode: map['postalCode'] as String,
      street: map['street'] as String,
    );
  }

  factory AddressModel.fromJson(Map<String, dynamic> json) {
    return AddressModel(
      apartment: json['apartment'] as String,
      city: json['city'] as String,
      country: json['country'] as String,
      postalCode: json['postalCode'] as String,
      street: json['street'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'apartment': apartment,
      'city': city,
      'country': country,
      'postalCode': postalCode,
      'street': street,
    };
  }

  AddressModel copyWith({
    String? apartment,
    String? city,
    String? postalCode,
    String? street,
  }) {
    return AddressModel(
      apartment: apartment ?? this.apartment,
      city: city ?? this.city,
      postalCode: postalCode ?? this.postalCode,
      street: street ?? this.street,
    );
  }
}
