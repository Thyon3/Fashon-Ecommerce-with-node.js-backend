import 'package:flutter/material.dart';
import 'package:frontend/core/resource/media.dart';
import 'package:google_fonts/google_fonts.dart';

class OnBoardingInfoSection extends StatelessWidget {
  const OnBoardingInfoSection.first({super.key}) : first = false;
  const OnBoardingInfoSection.second({super.key}) : first = true;
  final bool first;
  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Image.asset(
          first
              ? 'images/onBoardingImageTwo.png'
              : 'images/onBoardingImageOne.png',
          fit: BoxFit.cover,
          height: first ? 700 : 600,
        ),
        Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            first
                ? Text.rich(
                  textAlign: TextAlign.left,
                  TextSpan(
                    text: "${DateTime.now().year.toString()}\n",
                    style: GoogleFonts.lato(
                      textStyle: TextStyle(
                        fontSize: 60,
                        fontWeight: FontWeight.w900,
                        color: Colors.amber,
                      ),
                    ),

                    children: [
                      TextSpan(
                        text:
                            "Discover and shop \nThe latest trends In one place.",
                        style: GoogleFonts.lato(
                          textStyle: TextStyle(
                            fontSize: 35,
                            fontWeight: FontWeight.w900,
                            color:
                                Theme.of(
                                  context,
                                ).colorScheme.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
                : Align(
                  alignment: Alignment.centerLeft,
                  child: Text.rich(
                    textAlign: TextAlign.left,
                    TextSpan(
                      text: "FASHON\n",
                      style: GoogleFonts.lato(
                        textStyle: TextStyle(
                          letterSpacing: 30,
                          fontSize: 50,
                          fontWeight: FontWeight.w900,
                          color: Colors.amber,
                        ),
                      ),

                      children: [
                        TextSpan(
                          text: "  Fast, Simple\n And Secure",
                          style: GoogleFonts.lato(
                            textStyle: TextStyle(
                              letterSpacing: 0,
                              fontSize: 35,
                              fontWeight: FontWeight.w700,
                              color:
                                  Theme.of(
                                    context,
                                  ).colorScheme.onPrimaryContainer,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
          ],
        ),
      ],
    );
  }
}
