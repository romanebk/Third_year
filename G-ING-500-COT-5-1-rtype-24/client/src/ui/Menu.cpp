#include "ui/Menu.hpp"

#include "game/world.hpp"

#include <SFML/Graphics/RectangleShape.hpp>
#include <SFML/Graphics/Text.hpp>

namespace client {

namespace {

const unsigned kTextSize = 16;

} // namespace

Menu::Menu(SoundPlayer &sounds, float top, float centerX, float width, float lineHeight)
    : _sounds(sounds), _top(top), _centerX(centerX), _width(width), _lineHeight(lineHeight)
{
}

void Menu::setItems(const std::vector<std::string> &items)
{
    const bool firstTime = _items.empty();
    const std::string before = firstTime ? "" : _items[static_cast<std::size_t>(_selected)];
    _items = items;
    if (_selected >= static_cast<int>(_items.size())) {
        _selected = 0;
    }
    // "Music: 50%" became "Music: 60%": say the new value.
    if (!firstTime && !_items.empty() && _items[static_cast<std::size_t>(_selected)] != before) {
        speakSelected();
    }
}

void Menu::speakSelected(bool interrupt)
{
    if (!_items.empty()) {
        _sounds.say(_items[static_cast<std::size_t>(_selected)], interrupt);
    }
}

int Menu::getItemAt(sf::Vector2f position) const
{
    const float left = _centerX - _width / 2.0f;
    if (position.x < left || position.x > left + _width || position.y < _top) {
        return -1;
    }
    const int index = static_cast<int>((position.y - _top) / _lineHeight);
    return index < static_cast<int>(_items.size()) ? index : -1;
}

MenuAction Menu::handleEvent(const sf::Event &event, const sf::RenderWindow &window)
{
    const int count = static_cast<int>(_items.size());
    if (count == 0) {
        return MenuAction::None;
    }
    if (const auto *key = event.getIf<sf::Event::KeyPressed>()) {
        switch (key->code) {
        case sf::Keyboard::Key::Up:
            _selected = (_selected + count - 1) % count;
            _sounds.playSound("menu_move.ogg");
            speakSelected();
            return MenuAction::None;
        case sf::Keyboard::Key::Down:
            _selected = (_selected + 1) % count;
            _sounds.playSound("menu_move.ogg");
            speakSelected();
            return MenuAction::None;
        case sf::Keyboard::Key::Left:
            return MenuAction::Left;
        case sf::Keyboard::Key::Right:
            return MenuAction::Right;
        case sf::Keyboard::Key::Enter:
        case sf::Keyboard::Key::Space:
            _sounds.playSound("menu_select.ogg");
            return MenuAction::Choose;
        case sf::Keyboard::Key::Escape:
            return MenuAction::Back;
        default:
            return MenuAction::None;
        }
    }
    // The mouse position is converted from window pixels to game coordinates.
    if (const auto *moved = event.getIf<sf::Event::MouseMoved>()) {
        const int index = getItemAt(window.mapPixelToCoords(moved->position));
        if (index >= 0 && index != _selected) {
            _selected = index;
            _sounds.playSound("menu_move.ogg");
            speakSelected();
        }
    }
    if (const auto *click = event.getIf<sf::Event::MouseButtonPressed>()) {
        if (click->button == sf::Mouse::Button::Left &&
            getItemAt(window.mapPixelToCoords(click->position)) >= 0) {
            _sounds.playSound("menu_select.ogg");
            return MenuAction::Choose;
        }
    }
    return MenuAction::None;
}

void Menu::draw(sf::RenderWindow &window, const sf::Font &font) const
{
    const float left = _centerX - _width / 2.0f;
    for (int i = 0; i < static_cast<int>(_items.size()); i++) {
        const float y = _top + static_cast<float>(i) * _lineHeight;
        const bool selected = i == _selected;
        if (selected) {
            sf::RectangleShape highlight({_width, _lineHeight - 4.0f});
            highlight.setPosition({left, y});
            highlight.setFillColor(sf::Color(40, 60, 140, 200));
            highlight.setOutlineColor(sf::Color(255, 200, 60));
            highlight.setOutlineThickness(2.0f);
            window.draw(highlight);
        }
        sf::Text text(font, _items[static_cast<std::size_t>(i)], kTextSize);
        text.setFillColor(selected ? sf::Color(255, 200, 60) : sf::Color::White);
        // Centered horizontally in the menu.
        const float width = text.getLocalBounds().size.x;
        text.setPosition({left + (_width - width) / 2.0f, y + 8.0f});
        window.draw(text);
    }
}

} // namespace client
