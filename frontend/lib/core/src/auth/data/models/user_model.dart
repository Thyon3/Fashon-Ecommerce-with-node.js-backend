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
    super.street,
    super.apartment,
    super.city,
    super.postalCode,
    super.country,
    super.isActive,
    super.lastLogin,
    super.createdAt,
    super.updatedAt,
  });

  // Factory constructor for JSON serialization
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] as String? ?? json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      isAdmin: json['isAdmin'] as bool? ?? false,
      wishlist: (json['wishlist'] as List<dynamic>?)
          ?.map((item) => WishlistModel.fromJson(item as Map<String, dynamic>))
          .toList() ?? [],
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      address: json['address'] != null 
          ? AddressModel.fromJson(json['address'] as Map<String, dynamic>)
          : null,
      street: json['street'] as String?,
      apartment: json['apartment'] as String?,
      city: json['city'] as String?,
      postalCode: json['postalCode'] as String?,
      country: json['country'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      lastLogin: json['lastLogin'] != null 
          ? DateTime.parse(json['lastLogin'] as String)
          : null,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null 
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }

  // Method to convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'isAdmin': isAdmin,
      'wishlist': wishlist.map((item) {
        if (item is WishlistModel) {
          return item.toJson();
        }
        return item;
      }).toList(),
      'email': email,
      'phone': phone,
      'address': address != null && address is AddressModel 
          ? (address as AddressModel).toJson() 
          : address,
      'street': street,
      'apartment': apartment,
      'city': city,
      'postalCode': postalCode,
      'country': country,
      'isActive': isActive,
      'lastLogin': lastLogin?.toIso8601String(),
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  // Copy with method for immutability
  UserModel copyWith({
    String? id,
    String? name,
    bool? isAdmin,
    List<WishlistModel>? wishlist,
    String? email,
    String? phone,
    Address? address,
    String? street,
    String? apartment,
    String? city,
    String? postalCode,
    String? country,
    bool? isActive,
    DateTime? lastLogin,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      isAdmin: isAdmin ?? this.isAdmin,
      wishlist: wishlist ?? this.wishlist,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      street: street ?? this.street,
      apartment: apartment ?? this.apartment,
      city: city ?? this.city,
      postalCode: postalCode ?? this.postalCode,
      country: country ?? this.country,
      isActive: isActive ?? this.isActive,
      lastLogin: lastLogin ?? this.lastLogin,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

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
