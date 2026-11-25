#include "game/components.hpp"
#include "game/ecs_helpers.hpp"
#include "game/endless.hpp"
#include "game/enemies.hpp"
#include "game/level.hpp"
#include "game/world.hpp"
#include "network/packet.hpp"
#include "server/room.hpp"

#include <algorithm>
#include <asio/ip/address_v4.hpp>
#include <asio/ip/udp.hpp>
#include <cstdint>
#include <gtest/gtest.h>
#include <string>
#include <vector>

namespace {

using Bytes = std::vector<std::uint8_t>;
using Endpoint = asio::ip::udp::endpoint;

// Pretends the players cleared the level that is loaded: every enemy of its
// timeline is spawned and none is left.
void clearCurrentLevel(server::Room &room)
{
    engine::Registry &registry = room.registry();
    game::forEach<game::LevelRun>(
        registry, [](engine::Entity, game::LevelRun &run) { run.next = run.events.size(); });
    std::vector<engine::Entity> enemies;
    game::forEach<game::Enemy>(registry,
                               [&](engine::Entity e, game::Enemy &) { enemies.push_back(e); });
    for (const engine::Entity e : enemies) {
        registry.killEntity(e);
    }
}

void stepFor(server::Room &room, float seconds)
{
    for (int i = 0; i < static_cast<int>(seconds * 60.0f); ++i) {
        room.step();
    }
}

} // namespace

TEST(Room, FirstJoinCreatesShipsAndLevel)
{
    server::Room room(1);
    room.join(0);
    EXPECT_EQ(room.playerCount(), 1u);
    EXPECT_EQ(room.tick(), 0u);
}

TEST(Room, StepRunsGameTick)
{
    server::Room room(1);
    room.join(0);
    room.step();
    room.step();
    EXPECT_EQ(room.tick(), 2u);
}

TEST(Room, ApplyInputOnlyForKnownPlayerAndSkipsOld)
{
    server::Room room(1);
    room.join(0);
    net::InputMsg input;
    input.inputSeq = 1;
    EXPECT_TRUE(room.applyInput(0, input));
    EXPECT_FALSE(room.applyInput(5, input));
    EXPECT_FALSE(room.applyInput(0, input)); // same seq -> stale
    input.inputSeq = 0;
    EXPECT_FALSE(room.applyInput(0, input)); // <= last
    input.inputSeq = 2;
    EXPECT_TRUE(room.applyInput(0, input));
}

TEST(Room, LeaveKillsPlayer)
{
    server::Room room(1);
    room.join(0);
    room.join(1);
    EXPECT_EQ(room.playerCount(), 2u);
    room.leave(0);
    EXPECT_EQ(room.playerCount(), 1u);
    room.leave(5); // unknown ignored
    EXPECT_EQ(room.playerCount(), 1u);
}

TEST(Room, SnapshotContainsPlayerShipAndState)
{
    server::Room room(1);
    room.join(0);
    const auto snapshot = room.snapshot(0);
    ASSERT_FALSE(snapshot.empty());

    net::PacketHeader header;
    ASSERT_EQ(net::readHeader(snapshot.data(), snapshot.size(), header), net::HeaderStatus::Ok);
    EXPECT_EQ(header.type, net::MsgType::Snapshot);
    EXPECT_EQ(header.packetSeq, 0u); // first snapshot gets seq 0

    net::SnapshotMsg message;
    net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(reader, message));
    EXPECT_GE(message.entities.size(), 1u);
    EXPECT_EQ(message.state, static_cast<std::uint8_t>(game::RoomState::Playing));
    EXPECT_EQ(net::snapshotStage(message.self), 1u);
    ASSERT_EQ(message.players.size(), 1u);
    EXPECT_EQ(message.players[0].playerId, 0);
    EXPECT_EQ(message.players[0].lives, message.self.lives);
    EXPECT_EQ(message.players[0].score, message.self.score);
}

TEST(Room, SnapshotCarriesEveryBossBallVisualVariant)
{
    server::Room room(1);
    room.join(0);
    for (std::uint8_t visual = 0; visual <= 4; ++visual) {
        game::spawnEnemyBullet(room.registry(),
                               game::Position{100.0f, 100.0f + 20.0f * static_cast<float>(visual)},
                               game::Velocity{}, static_cast<game::BulletVisual>(visual));
    }

    const auto snapshot = room.snapshot(0);
    ASSERT_FALSE(snapshot.empty());
    net::SnapshotMsg message;
    net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(reader, message));

    std::vector<std::uint8_t> variants;
    for (const auto &entity : message.entities) {
        if (entity.type == static_cast<std::uint8_t>(game::EntityType::EnemyBullet)) {
            variants.push_back(entity.extra);
        }
    }
    std::sort(variants.begin(), variants.end());
    const std::vector<std::uint8_t> expected{0, 1, 2, 3, 4};
    EXPECT_EQ(variants, expected);
}

TEST(Room, BossBallsCarryTheBossVisualVariant)
{
    server::Room room(1);
    room.join(0);
    const engine::Entity boss =
        game::spawnEnemy(room.registry(), game::EnemyType::Boss, game::kBossHoverX, 270.0f);
    auto *state = room.registry().getComponent<game::BossState>(boss);
    ASSERT_NE(state, nullptr);
    state->arrived = true;
    state->fireTimer = 0.0f;
    room.step();

    const auto snapshot = room.snapshot(0);
    ASSERT_FALSE(snapshot.empty());
    net::SnapshotMsg message;
    net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(reader, message));

    bool found = false;
    for (const auto &entity : message.entities) {
        if (entity.type == static_cast<std::uint8_t>(game::EntityType::EnemyBullet)) {
            found = true;
            EXPECT_EQ(entity.extra, static_cast<std::uint8_t>(game::BulletVisual::Dobkeratops));
        }
    }
    EXPECT_TRUE(found);
}

TEST(Room, FourPlayersGetTheirOwnSnapshot)
{
    server::Room room(1);
    for (std::uint8_t player = 0; player < 4; ++player) {
        room.join(player);
    }
    room.step();

    for (std::uint8_t player = 0; player < 4; ++player) {
        const auto snapshot = room.snapshot(player);
        ASSERT_FALSE(snapshot.empty()) << "player " << static_cast<int>(player);

        net::PacketHeader header;
        ASSERT_EQ(net::readHeader(snapshot.data(), snapshot.size(), header), net::HeaderStatus::Ok);
        EXPECT_EQ(header.type, net::MsgType::Snapshot);

        net::SnapshotMsg message;
        net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
        ASSERT_TRUE(net::decode(reader, message));
        EXPECT_EQ(message.self.lives, 3);
        EXPECT_EQ(message.self.alive, 1);
        EXPECT_EQ(message.self.score, 0);
        EXPECT_GE(message.entities.size(), 4u);
        EXPECT_LE(message.entities.size(), game::kMaxSnapshotEntities);
        // Every client gets the HUD of the whole room, not only its own block.
        ASSERT_EQ(message.players.size(), 4u);
        for (std::size_t i = 0; i < message.players.size(); ++i) {
            EXPECT_EQ(message.players[i].playerId, i);
            EXPECT_EQ(message.players[i].lives, 3);
            EXPECT_EQ(message.players[i].alive, 1);
            EXPECT_EQ(message.players[i].score, 0);
        }
        EXPECT_EQ(message.players[player].lives, message.self.lives);
        EXPECT_EQ(message.players[player].score, message.self.score);
    }
}

TEST(Room, JoiningTheSamePlayerTwiceKeepsOneShip)
{
    server::Room room(1);
    room.join(0);
    room.join(0);
    EXPECT_EQ(room.playerCount(), 1u);

    const auto snapshot = room.snapshot(0);
    ASSERT_FALSE(snapshot.empty());
    net::SnapshotMsg message;
    net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(reader, message));
    EXPECT_EQ(message.entities.size(), 1u);
}

namespace {

template <typename Message>
bool decodeEvent(const server::ReliableEvent &event, net::MsgType type, Message &message)
{
    net::PacketHeader header;
    if (net::readHeader(event.datagram.data(), event.datagram.size(), header) !=
        net::HeaderStatus::Ok) {
        return false;
    }
    if (header.type != type) {
        return false;
    }
    net::Reader reader(event.datagram.data() + net::kHeaderSize,
                       event.datagram.size() - net::kHeaderSize);
    return net::decode(reader, message);
}

} // namespace

TEST(Room, GameEndCarriesTheReliableEventSequence)
{
    server::Room room(1);
    room.join(0);
    room.leave(0); // no ship left: the room is over

    const auto event = room.gameEnd();
    ASSERT_FALSE(event.datagram.empty());

    net::GameEndMsg message;
    ASSERT_TRUE(decodeEvent(event, net::MsgType::GameEnd, message));
    EXPECT_EQ(message.eventSeq, 1u); // first event of the room
    EXPECT_EQ(event.eventSeq, message.eventSeq);
    EXPECT_EQ(message.result, 2); // defeat: no player left
}

TEST(Room, StepEmitsSpawnEventsForNewEntities)
{
    server::Room room(1);
    room.join(0);
    room.step();

    const auto events = room.takeEvents();
    ASSERT_EQ(events.size(), 1u); // the player ship; enemies start at 2 s
    net::SpawnMsg spawn;
    ASSERT_TRUE(decodeEvent(events.front(), net::MsgType::Spawn, spawn));
    EXPECT_EQ(events.front().eventSeq, 1u);
    EXPECT_EQ(spawn.eventSeq, 1u);
    EXPECT_EQ(spawn.serverTick, 1u);
    EXPECT_EQ(spawn.entity.type, static_cast<std::uint8_t>(game::EntityType::Ship));
    EXPECT_NE(spawn.entity.netId, 0);
    EXPECT_TRUE(room.takeEvents().empty()); // drained
}

TEST(Room, LeaveEmitsADestroyEvent)
{
    server::Room room(1);
    room.join(0);
    room.step();
    const auto spawns = room.takeEvents();
    ASSERT_EQ(spawns.size(), 1u);
    net::SpawnMsg spawn;
    ASSERT_TRUE(decodeEvent(spawns.front(), net::MsgType::Spawn, spawn));

    room.leave(0);
    room.step();
    const auto events = room.takeEvents();
    ASSERT_EQ(events.size(), 1u);
    net::DestroyMsg destroy;
    ASSERT_TRUE(decodeEvent(events.front(), net::MsgType::Destroy, destroy));
    EXPECT_EQ(events.front().eventSeq, 2u);
    EXPECT_EQ(destroy.netId, spawn.entity.netId);
    EXPECT_EQ(destroy.reason, 0);
    EXPECT_EQ(destroy.serverTick, 2u);
}

TEST(Room, ResetDropsPendingEventsButKeepsTheSequence)
{
    server::Room room(1);
    room.join(0);
    room.step(); // one SPAWN pending, sequence now at 2

    room.reset();
    EXPECT_TRUE(room.takeEvents().empty());

    room.join(0);
    room.step();
    const auto events = room.takeEvents();
    ASSERT_EQ(events.size(), 1u);
    EXPECT_EQ(events.front().eventSeq, 2u); // the stream did not restart
}

TEST(Room, DifficultySetsTheStartingLives)
{
    server::Room hard(1, game::Difficulty::Hard);
    hard.join(0);
    auto snapshot = hard.snapshot(0);
    net::SnapshotMsg message;
    net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(reader, message));
    EXPECT_EQ(message.self.lives, 2); // Hard starts with 2 lives

    server::Room easy(1, game::Difficulty::Easy);
    easy.join(0);
    snapshot = easy.snapshot(0);
    net::Reader easyReader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(easyReader, message));
    EXPECT_EQ(message.self.lives, 5); // Easy starts with 5 lives
}

TEST(Room, ResetKeepsTheDifficulty)
{
    server::Room room(1, game::Difficulty::Hard);
    room.join(0);
    room.reset();
    room.join(0);
    const auto snapshot = room.snapshot(0);
    net::SnapshotMsg message;
    net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(reader, message));
    EXPECT_EQ(message.self.lives, 2);
}

TEST(Room, ResetStartsAFreshGame)
{
    server::Room room(1);
    room.join(0);
    room.step();
    room.step();
    ASSERT_EQ(room.tick(), 2u);

    room.reset();
    EXPECT_EQ(room.tick(), 0u);
    EXPECT_EQ(room.playerCount(), 0u);
    EXPECT_FALSE(room.hasPlayer(0));

    room.join(0); // the same instance serves the next game
    EXPECT_EQ(room.playerCount(), 1u);
    room.step();
    EXPECT_EQ(room.tick(), 1u);
}

// --- the campaign --------------------------------------------------------

TEST(Room, TheGameIsACampaignOfSeveralLevels)
{
    server::Room room(1);
    room.join(0);
    EXPECT_EQ(room.stage(), 1);

    clearCurrentLevel(room);
    stepFor(room, game::kStageClearDelay + 1.0f);

    EXPECT_EQ(room.stage(), 2);
    EXPECT_EQ(room.state(), game::RoomState::Playing); // level 1 is not the end

    const auto snapshot = room.snapshot(0);
    ASSERT_FALSE(snapshot.empty());
    net::SnapshotMsg message;
    net::Reader reader(snapshot.data() + net::kHeaderSize, snapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(reader, message));
    EXPECT_EQ(net::snapshotStage(message.self), 2u);
}

TEST(Room, TheGameIsWonOnlyWhenTheLastLevelIsCleared)
{
    server::Room room(1);
    room.join(0);
    clearCurrentLevel(room);
    stepFor(room, game::kStageClearDelay + 1.0f);
    ASSERT_EQ(room.stage(), game::levelCount());
    EXPECT_EQ(room.state(), game::RoomState::Playing);

    clearCurrentLevel(room);

    EXPECT_EQ(room.state(), game::RoomState::Victory);
}

TEST(Room, AResetRoomStartsTheCampaignAgainAtLevelOne)
{
    server::Room room(1);
    room.join(0);
    clearCurrentLevel(room);
    stepFor(room, game::kStageClearDelay + 1.0f);
    ASSERT_EQ(room.stage(), 2);

    room.reset();
    room.join(0);

    EXPECT_EQ(room.stage(), 1);
}

TEST(Room, TheSnapshotCapOfTheGameMatchesTheOneOfTheNetworkLibrary)
{
    EXPECT_EQ(game::kMaxSnapshotEntities, net::kMaxSnapshotEntities);
}

TEST(Room, TheEndlessModePlaysTheFirstWave)
{
    server::Room room(1, game::Difficulty::Normal, game::GameMode::Endless);
    room.join(0);

    std::size_t events = 0;
    game::forEach<game::LevelRun>(
        room.registry(), [&](engine::Entity, game::LevelRun &run) { events = run.events.size(); });
    EXPECT_EQ(events, game::endlessWave(0).size());
    EXPECT_EQ(room.stage(), 1);
}

TEST(Room, TheCampaignIsTheDefaultMode)
{
    server::Room room(1);
    room.join(0);

    std::size_t events = 0;
    game::forEach<game::LevelRun>(
        room.registry(), [&](engine::Entity, game::LevelRun &run) { events = run.events.size(); });
    EXPECT_EQ(events, game::level1().size());
}

TEST(Room, TheSnapshotCarriesTheModeAndTheStage)
{
    server::Room campaign(1);
    campaign.join(0);
    const auto campaignSnapshot = campaign.snapshot(0);
    ASSERT_FALSE(campaignSnapshot.empty());
    net::SnapshotMsg campaignMessage;
    net::Reader campaignReader(campaignSnapshot.data() + net::kHeaderSize,
                               campaignSnapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(campaignReader, campaignMessage));
    EXPECT_FALSE(net::snapshotEndless(campaignMessage.self));
    EXPECT_EQ(net::snapshotStage(campaignMessage.self), 1u);

    server::Room endless(2, game::Difficulty::Normal, game::GameMode::Endless);
    endless.join(0);
    const auto endlessSnapshot = endless.snapshot(0);
    ASSERT_FALSE(endlessSnapshot.empty());
    net::SnapshotMsg endlessMessage;
    net::Reader endlessReader(endlessSnapshot.data() + net::kHeaderSize,
                              endlessSnapshot.size() - net::kHeaderSize);
    ASSERT_TRUE(net::decode(endlessReader, endlessMessage));
    EXPECT_TRUE(net::snapshotEndless(endlessMessage.self));
    EXPECT_EQ(net::snapshotStage(endlessMessage.self), 1u);
}

TEST(Room, TheEndlessModeNeverEndsInAVictory)
{
    server::Room room(1, game::Difficulty::Normal, game::GameMode::Endless);
    room.join(0);

    // Every enemy of the wave is gone: a campaign would move on or win, endless goes on.
    game::forEach<game::LevelRun>(
        room.registry(), [](engine::Entity, game::LevelRun &run) { run.next = run.events.size(); });
    for (int i = 0; i < 60 * 8; ++i) {
        room.step();
    }
    EXPECT_NE(room.state(), game::RoomState::Victory);
    EXPECT_GE(room.stage(), 2); // the next wave was loaded
}

TEST(Room, ResetKeepsTheMode)
{
    server::Room room(1, game::Difficulty::Normal, game::GameMode::Endless);
    room.join(0);
    room.reset();
    room.join(0);

    std::size_t events = 0;
    game::forEach<game::LevelRun>(
        room.registry(), [&](engine::Entity, game::LevelRun &run) { events = run.events.size(); });
    EXPECT_EQ(events, game::endlessWave(0).size());
}
