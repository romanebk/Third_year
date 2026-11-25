/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Serializer.hpp
** Dépend de : include/mytorch/Serializer.hpp
*/

#include "mytorch/Serializer.hpp"

#include <cstring>
#include <fstream>

#include "mytorch/Activation.hpp"
#include "mytorch/Dense.hpp"
#include "mytorch/Errors.hpp"

namespace mytorch {

namespace {

const char kMagic[4] = {'M', 'Y', 'T', 'N'};
constexpr std::uint32_t kFormatVersion = 2;
constexpr std::uint32_t kMaxLayers = 4096;
constexpr std::uint32_t kMaxLabels = 256;

void writeU32(std::ostream &out, std::uint32_t value)
{
    out.write(reinterpret_cast<const char *>(&value), sizeof(value));
    if (!out)
        throw FileError("Serializer: écriture impossible");
}

void writeFloat(std::ostream &out, float value)
{
    out.write(reinterpret_cast<const char *>(&value), sizeof(value));
    if (!out)
        throw FileError("Serializer: écriture impossible");
}

std::uint32_t readU32(std::istream &in)
{
    std::uint32_t value = 0;
    in.read(reinterpret_cast<char *>(&value), sizeof(value));
    if (!in)
        throw FileError("Serializer: lecture impossible (fichier .nn tronqué)");
    return value;
}

float readFloat(std::istream &in)
{
    float value = 0.0f;
    in.read(reinterpret_cast<char *>(&value), sizeof(value));
    if (!in)
        throw FileError("Serializer: lecture impossible (fichier .nn tronqué)");
    return value;
}

void writeString(std::ostream &out, const std::string &text)
{
    writeU32(out, static_cast<std::uint32_t>(text.size()));
    out.write(text.data(), static_cast<std::streamsize>(text.size()));
    if (!out)
        throw FileError("Serializer: écriture impossible");
}

std::string readString(std::istream &in)
{
    std::uint32_t length = readU32(in);
    if (length > (1u << 20))
        throw FormatError("Serializer: longueur de chaîne absurde, fichier .nn corrompu ?");
    std::string text(length, '\0');
    in.read(text.data(), static_cast<std::streamsize>(length));
    if (!in)
        throw FileError("Serializer: lecture impossible (fichier .nn tronqué)");
    return text;
}

void writeLabels(std::ostream &out, const std::vector<std::string> &labels)
{
    std::string block;
    for (const auto &label : labels) {
        block += label;
        block += '\0';
    }
    writeString(out, block);
}

std::vector<std::string> readLabels(std::istream &in)
{
    std::string block = readString(in);
    std::vector<std::string> labels;
    std::string current;
    for (char c : block) {
        if (c == '\0') {
            labels.push_back(current);
            current.clear();
        } else {
            current += c;
        }
    }
    return labels;
}

void writeSettings(std::ostream &out, const TrainSettings &settings)
{
    writeU32(out, static_cast<std::uint32_t>(settings.epochs));
    writeU32(out, static_cast<std::uint32_t>(settings.batchSize));
    writeFloat(out, settings.learningRate);
    writeFloat(out, settings.momentum);
    writeFloat(out, settings.l2);
    writeFloat(out, settings.dropout);
    writeU32(out, settings.seed);
}

TrainSettings readSettings(std::istream &in)
{
    TrainSettings settings;
    settings.epochs = readU32(in);
    settings.batchSize = readU32(in);
    settings.learningRate = readFloat(in);
    settings.momentum = readFloat(in);
    settings.l2 = readFloat(in);
    settings.dropout = readFloat(in);
    settings.seed = readU32(in);
    if (settings.epochs == 0 || settings.batchSize == 0)
        throw FormatError("Serializer: hyperparamètres invalides dans le fichier .nn");
    if (settings.momentum < 0.0f || settings.momentum >= 1.0f)
        throw FormatError("Serializer: momentum invalide dans le fichier .nn");
    return settings;
}

} // namespace

std::unique_ptr<Layer> makeLayer(const std::string &type)
{
    if (type == "dense")
        return std::make_unique<Dense>();
    return makeActivation(type);
}

void writeNetwork(std::ostream &out, const NetworkFile &net)
{
    out.write(kMagic, sizeof(kMagic));
    if (!out)
        throw FileError("Serializer: écriture impossible");
    writeU32(out, kFormatVersion);
    writeU32(out, static_cast<std::uint32_t>(net.layers.size()));
    writeU32(out, static_cast<std::uint32_t>(net.inputSize));
    writeU32(out, static_cast<std::uint32_t>(net.numClasses));
    writeLabels(out, net.labels);
    writeSettings(out, net.training);
    for (const auto &layer : net.layers) {
        writeString(out, layer->type());
        layer->save(out);
    }
}

NetworkFile readNetwork(std::istream &in)
{
    char magic[4] = {};
    in.read(magic, sizeof(magic));
    if (!in)
        throw FileError("Serializer: lecture impossible (fichier .nn tronqué)");
    if (std::memcmp(magic, kMagic, sizeof(kMagic)) != 0)
        throw FormatError("Serializer: magic invalide, ce fichier n'est pas un réseau my_torch");
    std::uint32_t version = readU32(in);
    if (version != kFormatVersion)
        throw FormatError("Serializer: version de format " + std::to_string(version) +
                          " non supportée (version attendue : 2)");
    NetworkFile net;
    std::uint32_t nbLayers = readU32(in);
    if (nbLayers == 0 || nbLayers > kMaxLayers)
        throw FormatError("Serializer: nombre de couches invalide dans le fichier .nn");
    net.inputSize = readU32(in);
    net.numClasses = readU32(in);
    net.labels = readLabels(in);
    net.training = readSettings(in);
    for (std::uint32_t i = 0; i < nbLayers; i++) {
        std::string type = readString(in);
        std::unique_ptr<Layer> layer = makeLayer(type);
        layer->load(in);
        net.layers.push_back(std::move(layer));
    }
    return net;
}

void saveNetwork(const std::string &path, const NetworkFile &net)
{
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    if (!out.is_open())
        throw FileError("Serializer: impossible d'ouvrir le fichier '" + path + "'");
    writeNetwork(out, net);
}

NetworkFile loadNetwork(const std::string &path)
{
    std::ifstream in(path, std::ios::binary);
    if (!in.is_open())
        throw FileError("Serializer: impossible d'ouvrir le fichier '" + path + "'");
    return readNetwork(in);
}

} // namespace mytorch
