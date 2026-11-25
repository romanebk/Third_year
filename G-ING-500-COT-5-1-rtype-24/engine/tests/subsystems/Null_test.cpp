#include "engine/subsystems/Null.hpp"

#include <gtest/gtest.h>
#include <memory>

using engine::InputEvent;
using engine::Key;

// The game only sees the interfaces: any implementation can be plugged in.
TEST(Subsystems, GameCodeOnlyNeedsTheInterfaces)
{
    std::unique_ptr<engine::IGraphics> graphics = std::make_unique<engine::NullGraphics>();
    std::unique_ptr<engine::IAudio> audio = std::make_unique<engine::NullAudio>();

    ASSERT_TRUE(graphics->open(640, 480, "test"));
    EXPECT_TRUE(graphics->isOpen());
    graphics->clear({});
    graphics->drawRect({10.0f, 20.0f, 30.0f, 40.0f}, {255, 0, 0, 255});
    graphics->display();

    const auto sound = audio->loadSound("hit.ogg");
    ASSERT_TRUE(sound.has_value());
    audio->playSound(*sound);
    EXPECT_TRUE(audio->playMusic("theme.ogg"));
}

TEST(NullGraphics, RecordsWhatIsDrawn)
{
    engine::NullGraphics g;
    g.open(800, 600, "pong");
    EXPECT_EQ(g.width(), 800U);
    EXPECT_EQ(g.title(), "pong");

    g.clear({});
    g.drawRect({1.0f, 2.0f, 3.0f, 4.0f}, {});
    g.drawSprite(0, {}, {}, {1.0f, 1.0f});
    EXPECT_EQ(g.drawCalls(), 2U);
    EXPECT_FLOAT_EQ(g.lastRect().width, 3.0f);
    g.display();
    EXPECT_EQ(g.frames(), 1U);
    g.clear({});
    EXPECT_EQ(g.drawCalls(), 0U);
}

TEST(NullGraphics, KeyStateFollowsEvents)
{
    engine::NullGraphics g;
    g.open(10, 10, "");
    g.pushEvent({InputEvent::Type::KeyPressed, Key::Up});
    EXPECT_FALSE(g.isKeyDown(Key::Up)); // not polled yet
    EXPECT_EQ(g.pollEvents().size(), 1U);
    EXPECT_TRUE(g.isKeyDown(Key::Up));

    g.pushEvent({InputEvent::Type::KeyReleased, Key::Up});
    g.pollEvents();
    EXPECT_FALSE(g.isKeyDown(Key::Up));
}

TEST(NullGraphics, ClosedEventClosesTheWindow)
{
    engine::NullGraphics g;
    g.open(10, 10, "");
    g.pushEvent({InputEvent::Type::Closed, Key::Unknown});
    g.pollEvents();
    EXPECT_FALSE(g.isOpen());
}

TEST(NullAudio, CountsSoundsAndTracksMusic)
{
    engine::NullAudio a;
    const auto s = a.loadSound("a.ogg");
    a.playSound(*s, 0.5f);
    a.playSound(*s, 0.5f);
    EXPECT_EQ(a.soundsPlayed(), 2U);
    a.playMusic("theme.ogg", true);
    EXPECT_EQ(a.music(), "theme.ogg");
    a.stopMusic();
    EXPECT_TRUE(a.music().empty());
    a.setMasterVolume(0.3f);
    EXPECT_FLOAT_EQ(a.masterVolume(), 0.3f);
}
