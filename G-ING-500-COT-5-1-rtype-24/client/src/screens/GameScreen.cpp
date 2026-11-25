#include "screens/GameScreen.hpp"

#include "Client.hpp"
#include "game/endless.hpp"
#include "game/world.hpp"
#include "screens/ConnectScreen.hpp"
#include "screens/GameOverScreen.hpp"
#include "screens/MainMenuScreen.hpp"
#include "ui/TextUtils.hpp"
#include "world/Sprites.hpp"

#include <SFML/Graphics/CircleShape.hpp>
#include <SFML/Graphics/RectangleShape.hpp>
#include <SFML/Graphics/Sprite.hpp>
#include <algorithm>
#include <cmath>
#include <string>

namespace client {

namespace {

const float kInfoDuration = 3.0f;       // seconds a message stays on screen
const float kBossHitSoundDelay = 0.15f; // at most one "boss hit" sound every 0.15 s
const float kBannerDuration = 2.5f;     // seconds the "WAVE 4" banner stays on screen

} // namespace

GameScreen::GameScreen(Client &client, bool bossPreview)
    : Screen(client), _prediction(client.getPlayerId()), _bossPreview(bossPreview),
      _pauseMenu(client.getSounds(), 230.0f)
{
    _world.setLocalPlayer(_client.getPlayerId());
    _world.setSnapshotRate(_client.getSnapshotRate());
    _pauseMenu.setItems({"Resume", "Quit to menu"});
    _client.getSounds().playMusic("stage1.ogg");
}

void GameScreen::handleEvent(const sf::Event &event)
{
    if (_bossPreview) {
        if (const auto *key = event.getIf<sf::Event::KeyPressed>()) {
            if (key->code == sf::Keyboard::Key::Left || key->code == sf::Keyboard::Key::Right) {
                const int direction = key->code == sf::Keyboard::Key::Right ? 1 : -1;
                const int count = kBossKindCount;
                const int current = static_cast<int>(_previewBoss);
                _previewBoss = static_cast<BossKind>((current + direction + count) % count);
                _previewTime = 0.0f;
            } else if (key->code == sf::Keyboard::Key::Escape) {
                _client.changeScreen(std::make_unique<MainMenuScreen>(_client));
            }
        }
        return;
    }

    const Config &config = _client.getConfig();
    // Remember which keys are held down.
    if (const auto *pressed = event.getIf<sf::Event::KeyPressed>()) {
        _pressedKeys.insert(pressed->scancode);
    } else if (const auto *released = event.getIf<sf::Event::KeyReleased>()) {
        _pressedKeys.erase(released->scancode);
    } else if (event.is<sf::Event::FocusLost>()) {
        _pressedKeys.clear(); // a key released in another window must not stay down
    }

    if (!_paused) {
        const auto *key = event.getIf<sf::Event::KeyPressed>();
        if (key != nullptr && key->scancode == config.getKey(Action::Pause)) {
            setPaused(true);
        } else if (key != nullptr && key->scancode == config.getKey(Action::Summary)) {
            saySummary();
        }
        return;
    }
    // Pause menu. Solo: the game is frozen. Online: it goes on for the others.
    const MenuAction action = _pauseMenu.handleEvent(event, _client.getWindow());
    if (action == MenuAction::Back ||
        (action == MenuAction::Choose && _pauseMenu.getSelected() == 0)) {
        setPaused(false);
    } else if (action == MenuAction::Choose && _pauseMenu.getSelected() == 1) {
        _client.closeConnection();
        _client.changeScreen(std::make_unique<MainMenuScreen>(_client));
    }
}

void GameScreen::setPaused(bool paused)
{
    _paused = paused;
    if (paused) {
        _client.getSounds().say("Pause");
        _pauseMenu.speakSelected(false);
    }
    if (_client.getConnection() != nullptr) {
        _client.getConnection()->setPaused(paused);
    }
}

void GameScreen::update(float dt)
{
    if (_bossPreview) {
        _previewTime += dt;
        const int bossIndex = static_cast<int>(_previewBoss);
        _stage = bossIndex * kBossEveryEndlessWaves + 1;
        _endless = true;
        _client.updateGameBackground(dt);
        return;
    }
    if (_client.getConnection() == nullptr) {
        return;
    }
    readServerMessages();
    sendInputs(dt);
    _world.update(dt);
    _prediction.update(dt);
    _client.updateGameBackground(dt);
    if (_infoTime > 0.0f) {
        _infoTime -= dt;
    }
    if (_bannerTime > 0.0f) {
        _bannerTime -= dt;
    }
    if (_bossHitCooldown > 0.0f) {
        _bossHitCooldown -= dt;
    }
}

void GameScreen::readServerMessages()
{
    for (const ServerMessage &message : _client.getConnection()->receive()) {
        if (message.type == MessageType::Snapshot) {
            if (message.stage > _stage) {
                startStage(message.stage, message.endless);
            }
            const WorldChanges changes = _world.applySnapshot(message);
            correctPrediction(message);
            if (changes.newPlayerShots > 0) {
                _client.getSounds().playSound("shoot.ogg");
            }
            if (changes.newExplosion != 0) {
                playSoundAtEntity("explosion.ogg", changes.newExplosion);
            }
            if (changes.newEnemy != 0) {
                playSoundAtEntity("enemy.ogg", changes.newEnemy);
            }
            if (changes.localShipDestroyed) {
                _client.getSounds().playSound("player_hit.ogg");
                for (const PlayerInfo &player : message.players) {
                    if (player.id == _world.getLocalPlayer()) { // "lives 2"
                        _client.getSounds().say("lives " +
                                                std::to_string(std::max(0, player.lives)));
                    }
                }
            }
            playBossAndBonusSounds(changes);
        } else if (message.type == MessageType::PlayerLeft) {
            // The server tells us that another player left or crashed.
            showInfo(message.text + " left the game");
        } else if (message.type == MessageType::Error) {
            // Connection lost: back to the connection screen, with the reason.
            _client.closeConnection();
            _client.changeScreen(std::make_unique<ConnectScreen>(_client, message.text));
            return;
        } else if (message.type == MessageType::GameOver) {
            _client.changeScreen(std::make_unique<GameOverScreen>(
                _client, message.victory, message.players, _endless ? _stage : 0));
            return;
        }
    }
}

void GameScreen::correctPrediction(const ServerMessage &snapshot)
{
    const ClientEntity *ship = _world.getLocalShip();
    if (ship == nullptr) {
        _prediction.reset(); // dead: nothing to predict until it comes back
        return;
    }
    int speedLevel = 0;
    for (const PlayerInfo &player : snapshot.players) {
        if (player.id == _world.getLocalPlayer()) {
            speedLevel = player.speedLevel;
        }
    }
    // targetX / targetY: the position the server just sent.
    _prediction.correct(ship->targetX, ship->targetY, snapshot.ackInput, speedLevel);
}

void GameScreen::playBossAndBonusSounds(const WorldChanges &changes)
{
    SoundPlayer &sounds = _client.getSounds();
    if (changes.bossAppeared) {
        sounds.playSound("boss_alarm.ogg");
        showInfo(std::string("WARNING: ") + bossName(bossKindForStage(_stage, _endless)) +
                 " IS COMING");
    }
    if (changes.bossHit && _bossHitCooldown <= 0.0f) {
        sounds.playSound("boss_hit.ogg");
        _bossHitCooldown = kBossHitSoundDelay;
    }
    if (changes.bossEnraged) {
        sounds.playSound("boss_enrage.ogg");
        showInfo("THE BOSS IS ENRAGED!");
    }
    if (changes.bossDestroyed) {
        sounds.playSound("boss_explosion.ogg");
        showInfo("BOSS DESTROYED!");
    }
    if (changes.powerPickups > 0) {
        sounds.playSound("pickup_power.ogg");
    }
    if (changes.speedPickups > 0) {
        sounds.playSound("pickup_speed.ogg");
    }
}

void GameScreen::showInfo(const std::string &text)
{
    _infoText = text;
    _infoTime = kInfoDuration;
    _client.getSounds().say(text, false); // read aloud too, after the current words
}

void GameScreen::playSoundAtEntity(const std::string &name, std::uint32_t id)
{
    const auto it = _world.getEntities().find(id);
    if (it == _world.getEntities().end()) {
        _client.getSounds().playSound(name);
        return;
    }
    // Compared to our ship, or to the middle of the screen if it is not there.
    float fromX = game::kArenaWidth / 2.0f;
    float fromY = game::kArenaHeight / 2.0f;
    if (_prediction.isReady()) {
        fromX = _prediction.getX();
        fromY = _prediction.getY();
    }
    const ClientEntity &entity = it->second;
    const float pan = (entity.x - fromX) / (game::kArenaWidth / 2.0f);         // -1 left, 1 right
    const float pitch = 1.0f + 0.5f * (fromY - entity.y) / game::kArenaHeight; // 0.5 to 1.5
    _client.getSounds().playSoundAt(name, pan, pitch);
}

void GameScreen::saySummary()
{
    std::string text;
    for (const PlayerInfo &player : _world.getPlayers()) {
        if (player.id == _world.getLocalPlayer()) {
            text += "score " + std::to_string(player.score) + " lives " +
                    std::to_string(std::max(0, player.lives)) + " speed " +
                    std::to_string(player.speedLevel) + " power " +
                    std::to_string(player.forcePower) + " ";
        }
    }
    if (_stage > 0) {
        text += (_endless ? "wave " : "level ") + std::to_string(_stage) + " ";
    }
    const ClientEntity *boss = _world.getBoss();
    if (boss != nullptr && boss->maxHp > 0) {
        text += std::string(bossName(bossKindForStage(_stage, _endless))) + " " +
                std::to_string(boss->hp * 100 / boss->maxHp) + "%";
    } else {
        text += "no boss";
    }
    _client.getSounds().say(text);
}

void GameScreen::startStage(int stage, bool endless)
{
    _stage = stage;
    _endless = endless;
    // The game counts the waves from 0, the screen from 1.
    _bossWave = endless && game::isEndlessBossWave(stage - 1);
    if (!endless) {
        _bannerText = "LEVEL " + std::to_string(stage);
    } else if (_bossWave) {
        _bannerText = "BOSS WAVE " + std::to_string(stage);
    } else {
        _bannerText = "WAVE " + std::to_string(stage);
    }
    _bannerTime = kBannerDuration;
    _client.getSounds().say(_bannerText);
}

game::Input GameScreen::readKeyboard() const
{
    game::Input input;
    if (_paused) {
        return input; // nothing pressed while paused
    }
    const Config &config = _client.getConfig();
    input.up = _pressedKeys.count(config.getKey(Action::Up)) > 0;
    input.down = _pressedKeys.count(config.getKey(Action::Down)) > 0;
    input.left = _pressedKeys.count(config.getKey(Action::Left)) > 0;
    input.right = _pressedKeys.count(config.getKey(Action::Right)) > 0;
    input.fire = _pressedKeys.count(config.getKey(Action::Fire)) > 0;
    return input;
}

void GameScreen::sendInputs(float dt)
{
    // Inputs are sent at a fixed rate (60 per second, like the server ticks),
    // so the game speed never depends on the frame rate.
    _inputTimer += dt;
    while (_inputTimer >= game::kTickDt) {
        _inputTimer -= game::kTickDt;
        game::Input input = readKeyboard();
        _inputNumber++;
        input.seq = _inputNumber;
        _client.getConnection()->sendInput(input);
        _prediction.addInput(input);

        // Beam gauge: the server computes the real charge, this is only display.
        _chargeTime =
            input.fire ? std::min(_chargeTime + game::kTickDt, game::kBeamMaxCharge) : 0.0f;
    }
}

void GameScreen::drawBossBall(sf::RenderWindow &window, const ClientEntity &entity)
{
    switch (bossBallVisual(entity.extra)) {
    case game::BulletVisual::Dobkeratops: {
        sf::CircleShape ball(7.0f);
        ball.setOrigin({7.0f, 7.0f});
        ball.setPosition({entity.x, entity.y});
        ball.setFillColor(sf::Color(255, 115, 35));
        ball.setOutlineColor(sf::Color(255, 225, 120));
        ball.setOutlineThickness(2.0f);
        window.draw(ball);
        break;
    }
    case game::BulletVisual::Gomander: {
        sf::CircleShape ball(8.0f);
        ball.setOrigin({8.0f, 8.0f});
        ball.setPosition({entity.x, entity.y});
        ball.setFillColor(sf::Color(30, 185, 255));
        ball.setOutlineColor(sf::Color(190, 245, 255));
        ball.setOutlineThickness(2.0f);
        window.draw(ball);
        sf::CircleShape core(3.0f);
        core.setOrigin({3.0f, 3.0f});
        core.setPosition({entity.x, entity.y});
        core.setFillColor(sf::Color::White);
        window.draw(core);
        break;
    }
    case game::BulletVisual::Warship: {
        // The ball goes from its previous to its next position: that direction
        // turns the beam to face the player.
        const float angle =
            std::atan2(entity.targetY - entity.startY, entity.targetX - entity.startX);
        sf::RectangleShape glow({42.0f, 12.0f});
        glow.setOrigin({21.0f, 6.0f});
        glow.setPosition({entity.x, entity.y});
        glow.setRotation(sf::radians(angle));
        glow.setFillColor(sf::Color(50, 165, 255, 100));
        window.draw(glow);
        sf::RectangleShape core({32.0f, 5.0f});
        core.setOrigin({16.0f, 2.5f});
        core.setPosition({entity.x, entity.y});
        core.setRotation(sf::radians(angle));
        core.setFillColor(sf::Color(175, 240, 255));
        window.draw(core);
        break;
    }
    case game::BulletVisual::Compiler: {
        const float pulse = 1.0f + 0.35f * std::sin(entity.age * 12.0f);
        sf::CircleShape ring(9.0f * pulse);
        ring.setOrigin({9.0f * pulse, 9.0f * pulse});
        ring.setPosition({entity.x, entity.y});
        ring.setFillColor(sf::Color(180, 50, 235, 150));
        ring.setOutlineColor(sf::Color(255, 190, 255));
        ring.setOutlineThickness(2.0f);
        window.draw(ring);
        break;
    }
    case game::BulletVisual::Normal:
    default:
        break;
    }
}

void GameScreen::drawEntity(sf::RenderWindow &window, const ClientEntity &entity)
{
    // A boss ball is drawn from its variant, not from the sprite table.
    if (entity.type == game::EntityType::EnemyBullet &&
        bossBallVisual(entity.extra) != game::BulletVisual::Normal) {
        drawBossBall(window, entity);
        return;
    }

    // The server sends one Boss type for every boss: the stage/wave tells the
    // client which sprite of the four to draw.
    const SpriteInfo info = entity.type == game::EntityType::Boss
                                ? getBossSpriteInfo(bossKindForStage(_stage, _endless))
                                : getSpriteInfo(entity.type, entity.extra);
    int left = info.x;
    int top = info.y;
    if (entity.type == game::EntityType::Ship) {
        // One row of the sheet per player (different colors), frame = tilt.
        left = getShipFrame(entity.speedY) * kShipFrameWidth;
        top = std::clamp(entity.playerId, 0, 4) * kShipFrameHeight;
    } else if (info.frames > 1) {
        // Animation: frame number from the age of the entity.
        const int frame = static_cast<int>(entity.age / info.frameTime) % info.frames;
        left += frame * info.step;
    }

    sf::Sprite sprite(_client.getAssets().getTexture(info.sheet),
                      sf::IntRect({left, top}, {info.width, info.height}));
    // The server gives the CENTER of the entity.
    sprite.setOrigin(
        {static_cast<float>(info.width) / 2.0f, static_cast<float>(info.height) / 2.0f});
    sprite.setPosition({entity.x, entity.y});
    sprite.setScale({info.scale, info.scale});
    window.draw(sprite);

    // "P1".."P4" above each ship, so players are easy to tell apart.
    if (entity.type == game::EntityType::Ship) {
        drawText(window, _client.getFont(), "P" + std::to_string(entity.playerId + 1), 8, entity.x,
                 entity.y - 24.0f, sf::Color::White, true);
    }
    // "P" (Power) or "S" (Speed) above each bonus: the two kinds are told
    // apart without relying on their colors.
    if (entity.type == game::EntityType::PickupEnt) {
        const bool speed = entity.extra == static_cast<int>(game::PickupKind::Speed);
        drawText(window, _client.getFont(), speed ? "S" : "P", 8, entity.x, entity.y - 20.0f,
                 sf::Color(255, 230, 120), true);
    }
}

void GameScreen::drawBossPreviewShots(sf::RenderWindow &window, float bossX, float bossY,
                                      float shipX, float shipY)
{
    // The preview has no server: these balls are only drawn to show what the
    // boss fires. They never exist in the game, so they never deal damage.
    constexpr float kSpeed = 300.0f;
    constexpr float kLifetime = 2.2f;
    constexpr int kCount = 5;
    constexpr float kSpread = 0.18f;

    const float baseAngle = std::atan2(shipY - bossY, shipX - bossX);
    const int visual = static_cast<int>(_previewBoss) + 1; // BulletVisual of this boss
    for (int i = 0; i < kCount; ++i) {
        const float age =
            std::fmod(_previewTime + static_cast<float>(i) * kLifetime / kCount, kLifetime);
        // A small fan: two balls above the aim line, two below, one on it.
        const float angle = baseAngle + (static_cast<float>(i) - 2.0f) * kSpread;
        ClientEntity shot;
        shot.id = 100 + static_cast<std::uint32_t>(i);
        shot.type = game::EntityType::EnemyBullet;
        shot.extra = visual;
        shot.age = age;
        shot.x = bossX + std::cos(angle) * kSpeed * age;
        shot.y = bossY + std::sin(angle) * kSpeed * age;
        // The Warship beam uses the previous position to find its direction.
        shot.startX = shot.x - std::cos(angle);
        shot.startY = shot.y - std::sin(angle);
        shot.targetX = shot.x;
        shot.targetY = shot.y;
        drawEntity(window, shot);
    }
}

void GameScreen::drawBossPreview(sf::RenderWindow &window)
{
    ClientEntity boss;
    boss.id = 1;
    boss.type = game::EntityType::Boss;
    boss.x = 760.0f;
    boss.y = 270.0f;
    boss.age = _previewTime;
    boss.extra = static_cast<int>(_previewTime / 5.0f) % 2 + 1;
    drawEntity(window, boss);

    drawBossPreviewShots(window, boss.x, boss.y, 150.0f, 270.0f);

    ClientEntity ship;
    ship.id = 2;
    ship.type = game::EntityType::Ship;
    ship.playerId = 0;
    ship.x = 150.0f;
    ship.y = 270.0f;
    drawEntity(window, ship);

    const char *name = bossName(_previewBoss);
    drawText(window, _client.getFont(), name, 18, game::kArenaWidth / 2.0f, 28.0f,
             sf::Color(255, 200, 60), true);
    drawText(window, _client.getFont(), "LEFT / RIGHT: CHANGE BOSS", 10, game::kArenaWidth / 2.0f,
             465.0f, sf::Color::White, true);
    drawText(window, _client.getFont(), "ESC: RETURN TO MENU", 8, game::kArenaWidth / 2.0f, 490.0f,
             sf::Color(180, 190, 210), true);
    drawText(window, _client.getFont(), "VISUAL DEMO - NO GAMEPLAY DAMAGE", 8,
             game::kArenaWidth / 2.0f, 515.0f, sf::Color(150, 170, 190), true);
}

void GameScreen::drawBossBar(sf::RenderWindow &window)
{
    const ClientEntity *boss = _world.getBoss();
    if (boss == nullptr || boss->maxHp <= 0) {
        return;
    }
    const sf::Font &font = _client.getFont();
    const float width = 300.0f;
    const float left = (game::kArenaWidth - width) / 2.0f;
    const float top = 46.0f;
    const bool enraged = boss->extra >= 2; // phase 2 starts at half health
    const char *name = bossName(bossKindForStage(_stage, _endless));

    drawText(window, font, name, 8, left - 100.0f, top + 1.0f, sf::Color(255, 120, 90));
    sf::RectangleShape frame({width, 10.0f});
    frame.setPosition({left, top});
    frame.setFillColor(sf::Color(40, 0, 0));
    frame.setOutlineColor(sf::Color(255, 120, 90));
    frame.setOutlineThickness(1.0f);
    window.draw(frame);

    const float ratio =
        std::clamp(static_cast<float>(boss->hp) / static_cast<float>(boss->maxHp), 0.0f, 1.0f);
    sf::RectangleShape bar({width * ratio, 10.0f});
    bar.setPosition({left, top});
    bar.setFillColor(enraged ? sf::Color(230, 40, 40) : sf::Color(255, 150, 40));
    window.draw(bar);

    // The percentage is also written, so the bar is not the only clue.
    const int percent = static_cast<int>(ratio * 100.0f + 0.5f);
    drawText(window, font, std::to_string(percent) + "%" + (enraged ? " ENRAGED" : ""), 8,
             left + width + 10.0f, top + 1.0f, sf::Color::White);
}

void GameScreen::drawHud(sf::RenderWindow &window)
{
    const sf::Font &font = _client.getFont();
    // Score and lives of each player, along the top of the screen.
    for (const PlayerInfo &player : _world.getPlayers()) {
        const float x = 10.0f + static_cast<float>(player.id) * 240.0f;
        std::string text = "P" + std::to_string(player.id + 1) + " " + player.name;
        drawText(window, font, text, 10, x, 8.0f,
                 player.id == _world.getLocalPlayer() ? sf::Color(255, 200, 60) : sf::Color::White);
        drawText(window, font,
                 "SCORE " + std::to_string(player.score) + "  LIVES " +
                     std::to_string(std::max(0, player.lives)),
                 8, x, 24.0f);
    }
    // Level or wave, under the scores (unknown with r-type_server for now).
    if (_stage > 0) {
        drawText(window, font, (_endless ? "WAVE " : "LEVEL ") + std::to_string(_stage), 10, 10.0f,
                 40.0f, sf::Color(120, 220, 255));
    }

    drawBossBar(window);

    // Beam gauge at the bottom, like in the arcade game.
    drawText(window, font, "BEAM", 10, 360.0f, 515.0f);
    sf::RectangleShape frame({200.0f, 12.0f});
    frame.setPosition({410.0f, 514.0f});
    frame.setFillColor(sf::Color::Black);
    frame.setOutlineColor(sf::Color(90, 110, 200));
    frame.setOutlineThickness(1.0f);
    window.draw(frame);
    sf::RectangleShape bar({200.0f * _chargeTime / game::kBeamMaxCharge, 12.0f});
    bar.setPosition({410.0f, 514.0f});
    bar.setFillColor(sf::Color(90, 170, 255));
    window.draw(bar);
}

void GameScreen::draw(sf::RenderWindow &window)
{
    if (_bossPreview) {
        _client.drawGameBackground(_stage);
        drawBossPreview(window);
        return;
    }
    _client.drawGameBackground(_stage);
    const ClientEntity *localShip = _world.getLocalShip();
    for (const auto &[id, entity] : _world.getEntities()) {
        if (&entity == localShip && _prediction.isReady()) {
            // Our ship: drawn where the prediction says, not where the server was.
            ClientEntity predicted = entity;
            predicted.x = _prediction.getX();
            predicted.y = _prediction.getY();
            predicted.speedY = _prediction.getSpeedY();
            drawEntity(window, predicted);
        } else {
            drawEntity(window, entity);
        }
    }
    drawHud(window);
    if (_infoTime > 0.0f) {
        drawText(window, _client.getFont(), _infoText, 12, game::kArenaWidth / 2.0f, 70.0f,
                 sf::Color(255, 150, 120), true);
    }
    // Big banner in the middle at the start of a level or wave (red for a boss wave).
    if (_bannerTime > 0.0f) {
        drawText(window, _client.getFont(), _bannerText, 28, game::kArenaWidth / 2.0f, 230.0f,
                 _bossWave ? sf::Color(255, 80, 60) : sf::Color(255, 200, 60), true);
    }

    if (_paused) {
        sf::RectangleShape shade({game::kArenaWidth, game::kArenaHeight});
        shade.setFillColor(sf::Color(0, 0, 0, 150));
        window.draw(shade);
        drawText(window, _client.getFont(), "PAUSE", 28, game::kArenaWidth / 2.0f, 160.0f,
                 sf::Color(255, 200, 60), true);
        _pauseMenu.draw(window, _client.getFont());
    }
}

} // namespace client
