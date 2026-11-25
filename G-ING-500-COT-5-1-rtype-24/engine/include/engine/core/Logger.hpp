#pragma once

#include <functional>
#include <mutex>
#include <string_view>

namespace engine {

enum class LogLevel { Debug, Info, Warning, Error, Off };

// Leveled logger with a replaceable output (the "sink"). Thread-safe: the
// network thread and the game thread can log at the same time.
//
//   engine::logger().setLevel(engine::LogLevel::Debug);
//   engine::logger().info("room started");
//   engine::logger().setSink([](engine::LogLevel l, std::string_view m) { ... }); // tests, file
class Logger {
public:
    using Sink = std::function<void(LogLevel, std::string_view)>;

    Logger();

    void setLevel(LogLevel level);
    [[nodiscard]] LogLevel level() const;
    // An empty sink restores the default one (standard error, "[INFO] message").
    void setSink(Sink sink);

    // Ignored when below the current level.
    void log(LogLevel level, std::string_view message);
    void debug(std::string_view message) { log(LogLevel::Debug, message); }
    void info(std::string_view message) { log(LogLevel::Info, message); }
    void warning(std::string_view message) { log(LogLevel::Warning, message); }
    void error(std::string_view message) { log(LogLevel::Error, message); }

    [[nodiscard]] static std::string_view name(LogLevel level);

private:
    mutable std::mutex _mutex;
    LogLevel _level = LogLevel::Info;
    Sink _sink;
};

// The process-wide logger.
Logger &logger();

} // namespace engine
