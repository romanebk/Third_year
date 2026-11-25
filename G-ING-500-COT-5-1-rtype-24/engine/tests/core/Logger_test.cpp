#include "engine/core/Logger.hpp"

#include <gtest/gtest.h>
#include <string>
#include <utility>
#include <vector>

using engine::Logger;
using engine::LogLevel;

namespace {
struct Captured {
    std::vector<std::pair<LogLevel, std::string>> lines;
    Logger::Sink sink()
    {
        return [this](LogLevel l, std::string_view m) { lines.emplace_back(l, std::string(m)); };
    }
};
} // namespace

TEST(Logger, FiltersBelowTheLevel)
{
    Logger log;
    Captured out;
    log.setSink(out.sink());
    log.setLevel(LogLevel::Warning);

    log.debug("hidden");
    log.info("hidden");
    log.warning("shown");
    log.error("shown too");

    ASSERT_EQ(out.lines.size(), 2U);
    EXPECT_EQ(out.lines[0].first, LogLevel::Warning);
    EXPECT_EQ(out.lines[1].second, "shown too");
}

TEST(Logger, DefaultLevelIsInfo)
{
    Logger log;
    Captured out;
    log.setSink(out.sink());
    log.debug("hidden");
    log.info("shown");
    EXPECT_EQ(log.level(), LogLevel::Info);
    EXPECT_EQ(out.lines.size(), 1U);
}

TEST(Logger, OffSilencesEverything)
{
    Logger log;
    Captured out;
    log.setSink(out.sink());
    log.setLevel(LogLevel::Off);
    log.error("hidden");
    log.log(LogLevel::Off, "hidden");
    EXPECT_TRUE(out.lines.empty());
}

TEST(Logger, LevelNames)
{
    EXPECT_EQ(Logger::name(LogLevel::Debug), "DEBUG");
    EXPECT_EQ(Logger::name(LogLevel::Error), "ERROR");
}

TEST(Logger, GlobalLoggerIsShared)
{
    EXPECT_EQ(&engine::logger(), &engine::logger());
}
