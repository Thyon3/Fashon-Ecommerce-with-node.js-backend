import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class Address extends Equatable {
  Address({
    this.street,
    this.apartment,
    this.postalCode,
    this.city,
    this.country,
  });
  final String? street;
  final String? apartment;
  final String? postalCode;
  final String? country;
  final String? city;

  @override
  // TODO: implement props
  List<Object?> get props => [street, apartment, postalCode, country, city];

  Address.empty()
    : apartment = 'test apartment',
      city = 'tets city',
      country = 'test country',
      postalCode = 'postal code ',
      street = 'test street';

  bool get isEmpty =>
      street == null &&
      apartment == null &&
      postalCode == null &&
      country == null;
  bool get isNotEmpty => !isEmpty;
}
