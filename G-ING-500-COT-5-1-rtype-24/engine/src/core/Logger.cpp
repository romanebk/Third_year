#include "engine/core/Logger.hpp"

#include <iostream>
#include <utility>

namespace engine {

namespace {

void defaultSink(LogLevel level, std::string_view message)
{
    std::clog << '[' << Logger::name(level) << "] " << message << '\n';
}

} // namespace

Logger::Logger() : _sink(defaultSink) {}

void Logger::setLevel(LogLevel level)
{
    const std::lock_guard lock(_mutex);
    _level = level;
}

LogLevel Logger::level() const
{
    const std::lock_guard lock(_mutex);
    return _level;
}

void Logger::setSink(Sink sink)
{
    const std::lock_guard lock(_mutex);
    _sink = sink ? std::move(sink) : Sink(defaultSink);
}

void Logger::log(LogLevel level, std::string_view message)
{
    const std::lock_guard lock(_mutex);
    if (level == LogLevel::Off || level < _level) {
        return;
    }
    _sink(level, message);
}

std::string_view Logger::name(LogLevel level)
{
    switch (level) {
    case LogLevel::Debug:
        return "DEBUG";
    case LogLevel::Info:
        return "INFO";
    case LogLevel::Warning:
        return "WARNING";
    case LogLevel::Error:
        return "ERROR";
    case LogLevel::Off:
        return "OFF";
    }
    return "?";
}

Logger &logger()
{
    static Logger instance;
    return instance;
}

} // namespace engine
