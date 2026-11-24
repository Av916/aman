"use client";
import { SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeMenu() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Choose color theme">
          <SunMoon size={19} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {["Light", "Dark", "System"].map((theme) => (
          <DropdownMenuItem
            key={theme}
            onSelect={() => setTheme(theme.toLowerCase())}
          >
            {theme}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
