# title: The Lantern Keepers
# author: Knotebook

VAR courage = 0
VAR lantern = false

-> start

=== start ===
The tide has gone out, leaving the harbour grey and quiet. Somewhere below the pier, a bell is ringing underwater.
# bg: harbour-dusk

+ [Climb down to the water] -> climb
+ [Follow the bell along the shore] -> shore

=== climb ===
~ courage += 1
You lower yourself down the weed-slick ladder. The bell is louder here, and the water is breathing.
# sfx: water

* [Reach into the dark] -> reach
* [Climb back up] -> start

=== shore ===
You pick your way along the shingle. A lantern lies half-buried in the sand, its glass unbroken.
# image: lantern-on-shingle
~ lantern = true

+ [Pick up the lantern] -> keep
+ [Leave it and keep walking] -> walk

=== reach ===
{ courage > 0: You steel yourself and reach in. | You hesitate, then reach in. }
Your fingers close around something cold and patient.
-> END

=== keep ===
You lift the lantern. It is warm, as if someone set it down a moment ago.
+ [Light it] -> light
+ [Take it back to the harbour] -> END

=== walk ===
The bell stops. The shore is very quiet now.
// TODO: give this ending a little more weight.
-> END

=== light ===
The wick catches. For a moment the whole bay is gold.
# anim: glow
-> END
