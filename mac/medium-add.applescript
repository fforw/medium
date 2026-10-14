-- Finder "Open With" target for medium add: opens a Terminal window
-- and runs medium add there, so its prompts get an interactive shell.

on open theFiles
	set args to ""
	repeat with f in theFiles
		set args to args & " " & quoted form of POSIX path of f
	end repeat
	tell application "Terminal"
		-- A starting Terminal opens a window of its own; use that one
		if it is running then
			do script "medium add" & args
		else
			do script "medium add" & args in window 1
		end if
		activate
	end tell
end open

on run
	display dialog "Open images or videos with this app in Finder, or drop them on it." buttons {"OK"} default button 1
end run
