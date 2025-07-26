import 'package:frontend/core/common/entities/address.dart';
import 'package:frontend/core/common/entities/user.dart';
import 'package:frontend/core/src/auth/data/models/address_model.dart';
import 'package:frontend/core/src/wishlist/data/model/wishlist_model.dart';
import 'package:frontend/core/util/constants/typedefs.dart';

class UserModel extends User {
  UserModel({
    required super.id,
    required super.name,
    required super.isAdmin,
    required super.wishlist,
    required super.email,
    super.phone,
    super.address,
  });

  // Fields are inherited from User, do not redeclare them here.

  UserModel.empty()
    : super(
        id: 'test id',
        name: 'test name',
        isAdmin: false,
        wishlist: const [],
        email: 'testemail@gmail.com',
        phone: null,
        address: null,
      );

  UserModel copyWith({
    String? id,
    String? name,
    String? email,
    bool? isAdmin,
    List<WishList>? wishlist,
    Address? address,
    String? phone,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      isAdmin: isAdmin ?? this.isAdmin,
      wishlist: wishlist ?? this.wishlist,
      address: address ?? this.address,
      phone: phone ?? this.phone,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'isAdmin': isAdmin,
      'wishlist':
          wishlist
              .map((product) => (product as WishlistModel).toMap())
              .toList(),
      if (address != null) 'address': (address as AddressModel).toMap(),
      if (phone != null) 'phone': phone,
    };
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    final address = AddressModel.fromMap({
      if (map case {'street': String street}) 'street ': street,
      if (map case {'apartment': String apartment}) 'apartment': apartment,
      if (map case {'postalCode': String postalCode}) 'postalCode': postalCode,
      if (map case {'country': String country}) 'country': country,
      if (map case {'city': String city}) 'city': city,
    });
    return UserModel(
      id: map['id'] as String,
      name: map['name'] as String,
      email: map['email'] as String,
      isAdmin: map['isAdmin'] as bool,
      wishlist:
          (map['wishlist'] as List)
              .map(
                (item) => WishlistModel.fromMap(item as Map<String, dynamic>),
              )
              .toList()
              .cast<WishList>(),
      address: address.isEmpty ? null : address,
      phone: map['phone'] as String?,
    );
  }
}
