#include "engine/sfml/SfmlGraphics.hpp"

#include <SFML/Graphics/RectangleShape.hpp>
#include <SFML/Graphics/RenderWindow.hpp>
#include <SFML/Graphics/Sprite.hpp>
#include <SFML/Graphics/Texture.hpp>
#include <SFML/Window/Event.hpp>
#include <array>
#include <cstddef>
#include <string>
#include <utility>

namespace engine::sfml {

namespace {

Key toKey(sf::Keyboard::Key code)
{
    switch (code) {
    case sf::Keyboard::Key::Up:
        return Key::Up;
    case sf::Keyboard::Key::Down:
        return Key::Down;
    case sf::Keyboard::Key::Left:
        return Key::Left;
    case sf::Keyboard::Key::Right:
        return Key::Right;
    case sf::Keyboard::Key::W:
        return Key::W;
    case sf::Keyboard::Key::A:
        return Key::A;
    case sf::Keyboard::Key::S:
        return Key::S;
    case sf::Keyboard::Key::D:
        return Key::D;
    case sf::Keyboard::Key::Space:
        return Key::Space;
    case sf::Keyboard::Key::Enter:
        return Key::Enter;
    case sf::Keyboard::Key::Escape:
        return Key::Escape;
    default:
        return Key::Unknown;
    }
}

sf::Color toSf(Color c)
{
    return {c.r, c.g, c.b, c.a};
}

std::size_t index(Key key)
{
    return static_cast<std::size_t>(key);
}

} // namespace

struct SfmlGraphics::Impl {
    sf::RenderWindow window;
    std::vector<sf::Texture> textures;
    std::array<bool, static_cast<std::size_t>(Key::Count)> down{};
};

SfmlGraphics::SfmlGraphics() : _impl(std::make_unique<Impl>()) {}

SfmlGraphics::~SfmlGraphics() = default;

bool SfmlGraphics::open(unsigned width, unsigned height, std::string_view title)
{
    _impl->window.create(sf::VideoMode({width, height}), std::string(title));
    _impl->window.setVerticalSyncEnabled(true);
    return _impl->window.isOpen();
}

void SfmlGraphics::close()
{
    _impl->window.close();
}

bool SfmlGraphics::isOpen() const
{
    return _impl->window.isOpen();
}

std::vector<InputEvent> SfmlGraphics::pollEvents()
{
    std::vector<InputEvent> events;
    while (const std::optional<sf::Event> event = _impl->window.pollEvent()) {
        if (event->is<sf::Event::Closed>()) {
            events.push_back({InputEvent::Type::Closed, Key::Unknown});
        } else if (const auto *pressed = event->getIf<sf::Event::KeyPressed>()) {
            const Key key = toKey(pressed->code);
            _impl->down[index(key)] = true;
            events.push_back({InputEvent::Type::KeyPressed, key});
        } else if (const auto *released = event->getIf<sf::Event::KeyReleased>()) {
            const Key key = toKey(released->code);
            _impl->down[index(key)] = false;
            events.push_back({InputEvent::Type::KeyReleased, key});
        } else if (event->is<sf::Event::FocusLost>()) {
            _impl->down.fill(false); // keys released outside the window never arrive
        }
    }
    return events;
}

bool SfmlGraphics::isKeyDown(Key key) const
{
    return key != Key::Unknown && _impl->down[index(key)];
}

std::optional<TextureId> SfmlGraphics::loadTexture(const std::string &path)
{
    sf::Texture texture;
    if (!texture.loadFromFile(path)) {
        return std::nullopt;
    }
    _impl->textures.push_back(std::move(texture));
    return static_cast<TextureId>(_impl->textures.size() - 1);
}

void SfmlGraphics::clear(Color color)
{
    _impl->window.clear(toSf(color));
}

void SfmlGraphics::drawRect(const Rect &rect, Color color)
{
    sf::RectangleShape shape({rect.width, rect.height});
    shape.setPosition({rect.x, rect.y});
    shape.setFillColor(toSf(color));
    _impl->window.draw(shape);
}

void SfmlGraphics::drawSprite(TextureId texture, const Rect &source, Vec2f position, Vec2f scale)
{
    if (texture >= _impl->textures.size()) {
        return;
    }
    sf::Sprite sprite(
        _impl->textures[texture],
        sf::IntRect({static_cast<int>(source.x), static_cast<int>(source.y)},
                    {static_cast<int>(source.width), static_cast<int>(source.height)}));
    sprite.setPosition({position.x, position.y});
    sprite.setScale({scale.x, scale.y});
    _impl->window.draw(sprite);
}

void SfmlGraphics::display()
{
    _impl->window.display();
}

} // namespace engine::sfml
