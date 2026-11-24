# Pricing rules

Every pitch has an integer paise base hourly rate. A rule provides a replacement hourly rate and integer priority. Weekend defaults to Saturday and Sunday. Weekday defaults to Monday through Friday. Other rules cover all weekdays unless days are supplied. Holiday and special-event rules require both effective dates.

For each slot, resolve its local start date, weekday and clock time in the venue timezone. Match active rules whose inclusive effective dates and start-inclusive, end-exclusive time ranges cover that start. A band that crosses midnight carries its originating weekday and date criteria into the following date. Apply the highest priority or fall back to the base rate. Equal-priority intersecting active rules are rejected under the pitch lock, including intersecting overnight spill.

`slotPrice = floor((hourlyPaise × slotMinutes + 30) / 60)` rounds to the nearest paise. For example, ₹800 per hour produces a ₹400 half-hour slot. Changing a price reprices future available slots. Maintenance, held and booked rows retain their stored values. Dated discovery filters on the same eligible pitch and available slot whose hourly rate is shown on the card.
