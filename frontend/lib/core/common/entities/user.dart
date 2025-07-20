import 'package:equatable/equatable.dart';
import 'package:frontend/core/common/entities/address.dart';

class User extends Equatable {
  User({
    required this.id,
    required this.name,
    required this.isAdmin,
    required this.wishlist,
    required this.email,
    this.phone,
    this.address,
  });
  final String id;
  final String name;
  final String email;
  final bool isAdmin;
  final List<WishList> wishlist;
  final Address? address;
  final String? phone;

  @override
  // TODO: implement props
  List<Object?> get props => [
    id,
    name,
    isAdmin,
    phone,
    email,
    address,
    wishlist.length,
  ];

  User.empty()
    : id = 'test id',
      address = null,
      email = 'testemail@gmail.com',
      isAdmin = false,
      name = 'test name',
      phone = null,
      wishlist = const [];
}

class WishList {}
