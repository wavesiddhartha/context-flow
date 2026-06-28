import Cocoa

class KeyMonitor {
    var lastTimeCommand = Date()
    var lastTimeOption = Date()
    var lastTimeShift = Date()
    
    init() {
        NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged) { event in
            let flags = event.modifierFlags
            let now = Date()
            let keyCode = event.keyCode
            
            // Command Key (55)
            if keyCode == 55 {
                if flags.contains(.command) {
                    if now.timeIntervalSince(self.lastTimeCommand) < 0.35 {
                        print("DOUBLE_COMMAND")
                        fflush(stdout)
                    }
                    self.lastTimeCommand = now
                }
            }
            // Option Key (58)
            else if keyCode == 58 {
                if flags.contains(.option) {
                    if now.timeIntervalSince(self.lastTimeOption) < 0.35 {
                        print("DOUBLE_OPTION")
                        fflush(stdout)
                    }
                    self.lastTimeOption = now
                }
            }
            // Shift Key (56)
            else if keyCode == 56 {
                if flags.contains(.shift) {
                    if now.timeIntervalSince(self.lastTimeShift) < 0.35 {
                        print("DOUBLE_SHIFT")
                        fflush(stdout)
                    }
                    self.lastTimeShift = now
                }
            }
        }
    }
}

let monitor = KeyMonitor()
let app = NSApplication.shared
app.run()
