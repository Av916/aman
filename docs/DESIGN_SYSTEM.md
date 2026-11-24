# Design system

PitchMate pairs cricket photography with forest green, a lime accent and straightforward page layouts. The location pin contains cricket crease lines. The public hero and sample venues use generated editorial photography. Example venue names and prices illustrate future listing content.

| Token       | Light value | Use                                    |
| ----------- | ----------- | -------------------------------------- |
| Primary     | `#16845B`   | Primary action                         |
| Forest      | `#102F25`   | Dark brand surfaces and text on lime   |
| Accent      | `#C9F36B`   | High-emphasis actions on dark sections |
| Background  | `#F7F8F4`   | Page canvas                            |
| Foreground  | `#17211C`   | Text                                   |
| Surface     | `#FFFFFF`   | Cards and panels                       |
| Muted       | `#6B7280`   | Supporting text                        |
| Border      | `#E5E7EB`   | Dividers and card edges                |
| Success     | `#16A34A`   | Success palette                        |
| Warning     | `#F59E0B`   | Warning palette                        |
| Destructive | `#DC2626`   | Error text                             |

Manrope is used for headings and Inter for body text. Local variable WOFF2 files are loaded with `next/font`. Tailwind exposes the theme tokens. The theme menu offers light, dark and system preferences. Reduced motion disables smooth scrolling and long transitions. Text accompanies color for all verification statuses.

UI primitives follow the shadcn/ui component model with Radix behavior for dialogs, menus and avatars. Form fields have associated labels and inline errors, password visibility controls, and pending states. Sonner toasts acknowledge profile updates. Shared layouts contain page headings, breadcrumbs, dashboard navigation, stat cards, skeletons and empty and error states.

Use minimum 44 px targets for primary actions, visible keyboard focus, sensible heading order, and alternative text for meaningful photography. The landing page switches to a mobile dialog navigation, and the dashboard navigation moves above content on narrow screens. The accessibility target is WCAG 2.2 AA. A formal accessibility audit is pending.

## Marketplace patterns

Discovery uses a search toolbar, filter sidebar, mobile filter sheet and shareable search parameters. Cards show a venue image, factual pitch and price details, an accessible favorite action and a link to availability. List links remain usable when map tiles are unavailable. The mobile photo gallery scrolls with snap points.

The owner wizard saves each editable section to a persistent draft. Management tables identify publication and review state with text and badges. Schedule controls group intervals by weekday and label the overnight convention. Availability uses explicit labels for Available, Maintenance, Unavailable, and Booked. Destructive actions use confirmation dialogs.
